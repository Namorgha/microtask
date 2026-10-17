import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TaskCard } from "@/components/shared/TaskCard";
import { CategoryBadge, TASK_CATEGORIES } from "@/components/shared/CategoryBadge";
import { Map, List, Search, SlidersHorizontal, X, LocateFixed, MapPinOff, Plus, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TaskMap } from "@/components/map/TaskMap";
import { toast } from "sonner";
import { calculateDealConfidence } from "@/lib/dealConfidence";
import { calculateTaskQuality } from "@/lib/qualityEngine";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

const RADIUS_OPTIONS = [
  { value: 1, label: "1 km" },
  { value: 2, label: "2 km" },
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
  { value: 50, label: "50 km" },
];

export default function TaskFeed() {
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const mapSectionRef = useRef<HTMLDivElement>(null);

  // On small screens the map opens below the filters, so bring it into view.
  useEffect(() => {
    if (viewMode !== "map" || window.innerWidth >= 768) return;
    const id = window.setTimeout(() => mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => window.clearTimeout(id);
  }, [viewMode]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState([0, 200]);
  const [sortBy, setSortBy] = useState("newest");
  const [radiusKm, setRadiusKm] = useState(10);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const queryClient = useQueryClient();

  const defaultPrice: [number, number] = [0, 200];
  const filtersActive =
    !!searchQuery ||
    !!selectedCategory ||
    priceRange[0] !== defaultPrice[0] ||
    priceRange[1] !== defaultPrice[1] ||
    sortBy !== "newest";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setPriceRange(defaultPrice);
    setSortBy("newest");
  };

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocating(false);
        toast.success("Location found!");
      },
      () => {
        setLocating(false);
        toast.error("Unable to get location. Showing all tasks without distance filter.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: tasks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["tasks", selectedCategory, priceRange, sortBy],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, poster:profiles!tasks_poster_id_profiles_fkey(full_name, reputation_score, avatar_url, identity_verified, address_verified)")
        .eq("status", "open")
        .gte("price", priceRange[0])
        .lte("price", priceRange[1]);

      if (selectedCategory) query = query.eq("category", selectedCategory as any);
      if (sortBy === "price-low") query = query.order("price", { ascending: true });
      else if (sortBy === "price-high") query = query.order("price", { ascending: false });
      else query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredTasks = tasks.filter((task: any) => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (userLat && userLng) {
      const dist = getDistanceKm(userLat, userLng, task.lat, task.lng);
      if (dist > radiusKm) return false;
    }
    return true;
  });

  // Quality-aware ranking: when sorting by "newest", give higher-quality
  // tasks a small boost so spammy/low-quality posts don't dominate the top.
  const rankedTasks =
    sortBy === "newest"
      ? [...filteredTasks].sort((a: any, b: any) => {
          const qa = calculateTaskQuality(a).score;
          const qb = calculateTaskQuality(b).score;
          // Combine recency rank (already from query) with quality (0–100).
          // Recency is preserved via stable sort + small quality nudge.
          return qb - qa > 15 ? 1 : qa - qb > 15 ? -1 : 0;
        })
      : filteredTasks;

  return (
    <div className="container max-w-7xl py-6 md:py-10">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/60 pb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Discover Tasks
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px] max-w-xl">
            Find nearby tasks, request work, and start earning safely.
          </p>
        </div>
        <Button asChild size="lg" className="gap-2 shadow-sm">
          <Link to="/post-task">
            <Plus className="h-4 w-4" /> Post a Task
          </Link>
        </Button>
      </header>

      {/* Discovery controls */}
      <section className="mt-6 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 md:p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks by title…"
              className="pl-10 h-10 bg-background border-border/60"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter cluster */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={requestLocation}
              disabled={locating}
              className="gap-1.5 h-10"
            >
              <LocateFixed className={`h-4 w-4 ${locating ? "animate-pulse" : ""}`} />
              {locating ? "Locating…" : userLat ? "GPS on" : "Use GPS"}
            </Button>

            {userLat !== null && userLng !== null && (
              <Select value={String(radiusKm)} onValueChange={(v) => setRadiusKm(Number(v))}>
                <SelectTrigger className="w-full sm:w-[110px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[150px] h-10">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="price-low">Price: Low → High</SelectItem>
                <SelectItem value="price-high">Price: High → Low</SelectItem>
              </SelectContent>
            </Select>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-10">
                  <SlidersHorizontal className="h-4 w-4" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                <div className="mt-6 space-y-6">
                  <div>
                    <Label className="mb-3 block text-sm font-medium">
                      Price Range: ${priceRange[0]} – ${priceRange[1]}
                    </Label>
                    <Slider min={0} max={500} step={5} value={priceRange} onValueChange={setPriceRange} />
                  </div>
                  <div>
                    <Label className="mb-3 block text-sm font-medium">Category</Label>
                    <div className="flex flex-wrap gap-2">
                      {TASK_CATEGORIES.map((cat) => (
                        <CategoryBadge
                          key={cat}
                          category={cat}
                          selected={selectedCategory === cat}
                          onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 h-10 text-muted-foreground hover:text-foreground col-span-2 sm:col-auto">
                <RotateCcw className="h-3.5 w-3.5" /> Clear
              </Button>
            )}

            {/* View toggle */}
            <div className="col-span-2 flex rounded-lg border border-border/60 bg-muted/50 p-0.5 sm:ml-auto">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="gap-1.5 h-9 flex-1 sm:flex-none"
              >
                <List className="h-4 w-4" /> List
              </Button>
              <Button
                variant={viewMode === "map" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("map")}
                className="gap-1.5 h-9 flex-1 sm:flex-none"
              >
                <Map className="h-4 w-4" /> Map
              </Button>
            </div>
          </div>
        </div>

        {/* Category chips */}
        <div className="mt-4 flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 [&>*]:shrink-0">
          {TASK_CATEGORIES.map((cat) => (
            <CategoryBadge
              key={cat}
              category={cat}
              selected={selectedCategory === cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            />
          ))}
        </div>
      </section>

      {/* Results summary */}
      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {isLoading ? (
            "Loading tasks…"
          ) : (
            <>
              <span className="font-semibold text-foreground">{filteredTasks.length}</span>{" "}
              {filteredTasks.length === 1 ? "task" : "tasks"}
              {userLat !== null && userLng !== null
                ? ` within ${radiusKm} km`
                : " — enable GPS for distance filtering"}
              {sortBy === "newest" && " · sorted by newest"}
              {sortBy === "price-low" && " · price low to high"}
              {sortBy === "price-high" && " · price high to low"}
            </>
          )}
        </p>
      </div>

      {/* Content */}
      <div className="mt-5">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : viewMode === "list" ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rankedTasks.map((task: any) => {
              const confidence = calculateDealConfidence({
                task,
                poster: task.poster
                  ? {
                      full_name: task.poster.full_name,
                      avatar_url: task.poster.avatar_url,
                      reputation_score: task.poster.reputation_score,
                    }
                  : null,
              });
              return (
              <TaskCard
                key={task.id}
                id={task.id}
                title={task.title}
                description={task.description}
                price={Number(task.price)}
                duration={task.duration}
                category={task.category}
                location={task.location}
                distance={userLat && userLng ? `${getDistanceKm(userLat, userLng, task.lat, task.lng).toFixed(1)} km` : undefined}
                posterName={task.poster?.full_name || "Anonymous"}
                posterRating={Number(task.poster?.reputation_score || 0)}
                posterIdentityVerified={!!task.poster?.identity_verified}
                posterAddressVerified={!!task.poster?.address_verified}
                status={task.status}
                imageUrl={task.images?.[0]}
                confidence={confidence}
                createdAt={task.created_at}
              />
              );
            })}
            {filteredTasks.length === 0 && (
              <EmptyState hasLocation={userLat !== null} onClear={clearFilters} canClear={filtersActive} />
            )}
          </div>
        ) : (
          <div ref={mapSectionRef} className="h-[70svh] min-h-[420px] md:h-[calc(100vh-320px)] md:min-h-[480px] scroll-mt-20 rounded-xl overflow-hidden border border-border/60 shadow-sm">
            <TaskMap tasks={filteredTasks} userLat={userLat} userLng={userLng} radiusKm={radiusKm} />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasLocation, onClear, canClear }: { hasLocation: boolean; onClear: () => void; canClear: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-border/60 bg-card/40">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
        <MapPinOff className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <p className="text-lg font-display font-semibold text-foreground">
        No tasks found nearby
      </p>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
        Try expanding your distance, changing filters, or post a task yourself.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {canClear && (
          <Button variant="outline" size="sm" onClick={onClear} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
          </Button>
        )}
        <Button asChild size="sm" className="gap-1.5">
          <Link to="/post-task">
            <Plus className="h-3.5 w-3.5" /> Post a Task
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="p-5 space-y-3">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-6 w-12" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex items-center gap-2 pt-3 border-t border-border/60">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5">
      <p className="text-lg font-display font-semibold text-foreground">Couldn't load tasks</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        Something went wrong while fetching tasks. Please try again.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-5 gap-1.5">
        <RotateCcw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
