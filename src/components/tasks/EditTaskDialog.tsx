import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LocateFixed, MapPin, DollarSign, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CategoryBadge, TASK_CATEGORIES } from "@/components/shared/CategoryBadge";
import { LocationPicker } from "@/components/map/LocationPicker";
import { supabase } from "@/integrations/supabase/client";
import { reverseGeocode } from "@/lib/geocode";
import { useToast } from "@/hooks/use-toast";

// Same rules as Post a Task.
const schema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(1000),
  category: z.string().min(1, "Select a category"),
  price: z.number().min(5, "Minimum price is $5").max(500, "Maximum price is $500"),
  duration: z.number().min(10).max(60),
  location: z.string().trim().min(2, "Location is required").max(200),
});

interface EditableTask {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number | string;
  duration: number;
  location: string;
  lat: number | null;
  lng: number | null;
}

export function EditTaskDialog({ task }: { task: EditableTask }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [category, setCategory] = useState(task.category);
  const [price, setPrice] = useState(Number(task.price));
  const [duration, setDuration] = useState([task.duration]);
  const [location, setLocation] = useState(task.location);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    task.lat != null && task.lng != null ? { lat: Number(task.lat), lng: Number(task.lng) } : null,
  );

  // Reset the form to the saved task every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTitle(task.title);
    setDescription(task.description);
    setCategory(task.category);
    setPrice(Number(task.price));
    setDuration([task.duration]);
    setLocation(task.location);
    setCoords(task.lat != null && task.lng != null ? { lat: Number(task.lat), lng: Number(task.lng) } : null);
    setErrors({});
  }, [open, task]);

  // Address auto-fill when the pin moves (debounced for Nominatim's 1 req/s limit).
  const [resolving, setResolving] = useState(false);
  const timer = useRef<number>();
  const abort = useRef<AbortController>();
  const pickPoint = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    window.clearTimeout(timer.current);
    abort.current?.abort();
    timer.current = window.setTimeout(async () => {
      const ctrl = new AbortController();
      abort.current = ctrl;
      setResolving(true);
      try {
        const address = await reverseGeocode(lat, lng, ctrl.signal);
        if (address && !ctrl.signal.aborted) setLocation(address);
      } catch {
        /* keep the current text */
      } finally {
        if (!ctrl.signal.aborted) setResolving(false);
      }
    }, 600);
  }, []);
  useEffect(() => () => { window.clearTimeout(timer.current); abort.current?.abort(); }, []);

  const [locating, setLocating] = useState(false);
  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); pickPoint(pos.coords.latitude, pos.coords.longitude); },
      () => { setLocating(false); toast({ title: "Could not get location", variant: "destructive" }); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = async () => {
    const parsed = schema.safeParse({ title, description, category, price, duration: duration[0], location });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { next[String(i.path[0])] = i.message; });
      setErrors(next);
      return;
    }
    if (!coords) {
      setErrors({ location: "Drop a pin on the map" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category as never,
        price: parsed.data.price,
        duration: parsed.data.duration,
        location: parsed.data.location,
        lat: coords.lat,
        lng: coords.lng,
      })
      .eq("id", task.id);
    setSaving(false);

    if (error) {
      // The database refuses edits once someone has requested the task.
      toast({ title: "Couldn't save changes", description: error.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["task-applications", task.id] });
      return;
    }
    toast({ title: "Task updated" });
    queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    setOpen(false);
  };

  const fieldError = (k: string) => errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2">
          <Pencil className="h-4 w-4" /> Edit task
        </Button>
      </DialogTrigger>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-h-[92svh] w-[calc(100vw-24px)] max-w-xl overflow-y-auto rounded-2xl p-5 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display">Edit task</DialogTitle>
          <DialogDescription>You can edit until someone requests your task.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
            {fieldError("title")}
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {TASK_CATEGORIES.map((c) => (
                <CategoryBadge key={c} category={c} selected={category === c} onClick={() => setCategory(c)} />
              ))}
            </div>
            {fieldError("category")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className="min-h-[110px]" />
            {fieldError("description")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-price">Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="edit-price" type="number" inputMode="decimal" min={5} max={500} className="pl-9"
                  value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
              </div>
              {fieldError("price")}
            </div>
            <div className="space-y-2">
              <Label>Duration: <span className="font-semibold text-primary">{duration[0]} min</span></Label>
              <div className="flex h-10 items-center">
                <Slider min={10} max={60} step={5} value={duration} onValueChange={setDuration} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="edit-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} className="pl-9 pr-11" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-1/2 h-9 w-9 -translate-y-1/2"
                onClick={useMyLocation} disabled={locating} aria-label="Use my location" title="Use my location">
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              </Button>
            </div>
            {resolving
              ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Finding address…</p>
              : fieldError("location")}
            <div className="overflow-hidden rounded-xl border border-border">
              {open && <LocationPicker lat={coords?.lat ?? null} lng={coords?.lng ?? null} onLocationChange={pickPoint} height="200px" />}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
