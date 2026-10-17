import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { CategoryBadge, TASK_CATEGORIES } from "@/components/shared/CategoryBadge";
import { MapPin, DollarSign, ImagePlus, Loader2, LocateFixed, MapPinOff, CheckCircle2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { useEmailVerificationRequired } from "@/hooks/useEmailVerificationRequired";
import { LocationPicker } from "@/components/map/LocationPicker";
import { cn } from "@/lib/utils";
import { calculateTaskQuality } from "@/lib/qualityEngine";
import { reverseGeocode } from "@/lib/geocode";
import { QualityHints } from "@/components/quality/QualityHints";

const taskSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(1000),
  category: z.string().min(1, "Select a category"),
  price: z.number().min(5, "Minimum price is $5").max(500, "Maximum price is $500"),
  duration: z.number().min(10).max(60),
  location: z.string().trim().min(2, "Location is required").max(200),
});

const rateLimiter = {
  timestamps: [] as number[],
  check(maxPerMinute = 3): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < 60000);
    if (this.timestamps.length >= maxPerMinute) return false;
    this.timestamps.push(now);
    return true;
  },
};

const STEPS = [
  { id: 1, title: "What", desc: "Title & category" },
  { id: 2, title: "Details", desc: "Description" },
  { id: 3, title: "Location", desc: "Where & when" },
  { id: 4, title: "Price", desc: "Set your budget" },
];

const PRICE_SUGGESTIONS = [15, 25, 40, 60, 100];

export default function PostTask() {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState(25);
  const [duration, setDuration] = useState([30]);
  const [location, setLocation] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const emailVerifRequired = useEmailVerificationRequired();

  const liveQuality = calculateTaskQuality({
    title,
    description,
    category,
    price,
    duration: duration[0],
    location,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    images: images.map(() => "x"),
  });

  // Address auto-fill: every time a point is chosen (map tap, pin drag, GPS),
  // look up its street address and put it in the input. The user can still edit it.
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const geocodeTimer = useRef<number>();
  const geocodeAbort = useRef<AbortController>();

  const fillAddressFrom = useCallback((lat: number, lng: number, { onlyIfEmpty = false } = {}) => {
    window.clearTimeout(geocodeTimer.current);
    geocodeAbort.current?.abort();
    // Debounce: Nominatim allows 1 request/second, and pin drags fire quickly.
    geocodeTimer.current = window.setTimeout(async () => {
      const ctrl = new AbortController();
      geocodeAbort.current = ctrl;
      setResolvingAddress(true);
      try {
        const address = await reverseGeocode(lat, lng, ctrl.signal);
        if (address && !ctrl.signal.aborted) {
          setLocation((current) => (onlyIfEmpty && current.trim() ? current : address));
        }
      } catch {
        /* network error or aborted: keep whatever the user has typed */
      } finally {
        if (!ctrl.signal.aborted) setResolvingAddress(false);
      }
    }, 600);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(geocodeTimer.current);
    geocodeAbort.current?.abort();
  }, []);

  const pickPoint = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    fillAddressFrom(lat, lng);
  }, [fillAddressFrom]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          fillAddressFrom(pos.coords.latitude, pos.coords.longitude, { onlyIfEmpty: true });
        },
        () => {}
      );
    }
  }, [fillAddressFrom]);

  const [locating, setLocating] = useState(false);
  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location isn't supported on this device", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pickPoint(pos.coords.latitude, pos.coords.longitude);
        toast({ title: "Location updated" });
      },
      () => {
        setLocating(false);
        toast({ title: "Could not get location", description: "Allow location access, or tap the map to drop a pin.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const maxSize = 5 * 1024 * 1024;
      const newFiles = Array.from(e.target.files).filter((f) => {
        if (!allowed.includes(f.type)) {
          toast({ title: "Invalid file type", variant: "destructive" });
          return false;
        }
        if (f.size > maxSize) {
          toast({ title: "File too large (max 5MB)", variant: "destructive" });
          return false;
        }
        return true;
      });
      setImages((prev) => [...prev, ...newFiles].slice(0, 3));
    }
  };

  const canProceed = (s: number) => {
    if (s === 1) return title.trim().length >= 3 && category;
    if (s === 2) return description.trim().length >= 10;
    if (s === 3) return location.trim().length >= 2 && coords;
    if (s === 4) return price >= 5;
    return true;
  };

  const next = () => {
    if (!canProceed(step)) {
      toast({ title: "Please complete this step first", variant: "destructive" });
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (emailVerifRequired && !user.email_confirmed_at) {
      toast({ title: "Email verification required", variant: "destructive" });
      navigate("/verify-email");
      return;
    }
    if (!rateLimiter.check(3)) {
      toast({ title: "Too many tasks", description: "Please wait a minute.", variant: "destructive" });
      return;
    }
    if (!coords) {
      toast({ title: "Location required", variant: "destructive" });
      return;
    }
    const validation = taskSchema.safeParse({ title, description, category, price, duration: duration[0], location });
    if (!validation.success) {
      toast({ title: "Validation error", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const imageUrls: string[] = [];
      for (const image of images) {
        const ext = image.name.split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("task-images").upload(path, image);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("task-images").getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase.from("tasks").insert({
        poster_id: user.id,
        title: validation.data.title,
        description: validation.data.description,
        category: validation.data.category as any,
        price: validation.data.price,
        duration: validation.data.duration,
        location: validation.data.location,
        lat: coords.lat,
        lng: coords.lng,
        images: imageUrls,
      });
      if (error) throw error;

      toast({ title: "Task Posted!", description: "Your task is now live." });
      navigate("/my-tasks");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8 md:py-12">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Post a Task</h1>
        <p className="text-muted-foreground mt-2">Tell us what you need — we'll find someone to help.</p>
      </div>

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all",
                    step > s.id
                      ? "bg-primary text-primary-foreground"
                      : step === s.id
                      ? "bg-gradient-gold text-accent-foreground shadow-gold scale-110"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step > s.id ? <Check className="h-5 w-5" /> : s.id}
                </div>
                <p className={cn("text-xs mt-2 font-medium hidden sm:block", step === s.id ? "text-foreground" : "text-muted-foreground")}>
                  {s.title}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-0.5 flex-1 -mx-2 -mt-5 sm:-mt-8 transition-colors", step > s.id ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card className="shadow-card border-border/60">
        <CardContent className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-semibold">What do you need?</h2>
                    <p className="text-sm text-muted-foreground mt-1">Give your task a clear, short title.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Task title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Pick up groceries from Trader Joe's"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={100}
                      className="h-12 text-base"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground text-right">{title.length}/100</p>
                  </div>
                  <div className="space-y-3">
                    <Label>Category</Label>
                    <div className="flex flex-wrap gap-2">
                      {TASK_CATEGORIES.map((cat) => (
                        <CategoryBadge key={cat} category={cat} selected={category === cat} onClick={() => setCategory(cat)} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Describe the task</h2>
                    <p className="text-sm text-muted-foreground mt-1">More detail helps you get the right help, faster.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc">Description</Label>
                    <Textarea
                      id="desc"
                      placeholder="What needs to be done? Include any specific instructions, items, or preferences..."
                      rows={6}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={1000}
                      className="text-base resize-none"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground text-right">{description.length}/1000</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Photos (optional, up to 3)</Label>
                    <div className="flex gap-3 flex-wrap">
                      {images.map((img, i) => (
                        <div key={i} className="relative h-24 w-24 rounded-xl overflow-hidden border-2 border-border">
                          <img src={URL.createObjectURL(img)} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center hover:scale-110 transition-transform"
                            onClick={() => setImages(images.filter((_, j) => j !== i))}
                          >×</button>
                        </div>
                      ))}
                      {images.length < 3 && (
                        <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                          <ImagePlus className="h-6 w-6" />
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageChange} />
                        </label>
                      )}
                    </div>
                  </div>
                  <QualityHints result={liveQuality} title="Task quality so far" compact />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Where is it?</h2>
                    <p className="text-sm text-muted-foreground mt-1">Auto-detect your location or pick on the map.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Address or area</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="location"
                        placeholder="Enter address or area"
                        className="pl-9 pr-12 h-12 text-base"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        maxLength={200}
                      />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={detectLocation} disabled={locating} title="Use my location" aria-label="Use my location">
                        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      {resolvingAddress ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          <span className="text-muted-foreground">Finding address…</span>
                        </>
                      ) : coords ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          <span className="text-success">Location set — tap the map or drag the pin to adjust</span>
                        </>
                      ) : (
                        <>
                          <MapPinOff className="h-3.5 w-3.5 text-warning" />
                          <span className="text-warning-foreground/80">Pick a spot on the map below</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Pin on map</Label>
                    <div className="rounded-xl overflow-hidden border-2 border-border">
                      <LocationPicker
                        lat={coords?.lat ?? null}
                        lng={coords?.lng ?? null}
                        onLocationChange={pickPoint}
                        height="240px"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <Label>Estimated duration: <span className="text-primary font-semibold">{duration[0]} min</span></Label>
                    <Slider min={10} max={60} step={5} value={duration} onValueChange={setDuration} />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Set your price</h2>
                    <p className="text-sm text-muted-foreground mt-1">Fair pricing helps your task get accepted faster.</p>
                  </div>
                  <div className="rounded-2xl bg-gradient-hero border border-border/60 p-6 text-center">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Your offer</p>
                    <div className="font-display text-5xl font-bold text-accent">${price}</div>
                  </div>
                  <div className="space-y-3">
                    <Label>Quick suggestions</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {PRICE_SUGGESTIONS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPrice(p)}
                          className={cn(
                            "rounded-xl border-2 py-3 font-display font-semibold text-sm transition-all",
                            price === p
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border bg-card hover:border-accent/50 text-foreground"
                          )}
                        >
                          ${p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Custom amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="price"
                        type="number"
                        min={5}
                        max={500}
                        className="pl-9 h-12 text-base"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value) || 0)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Min $5 — Max $500</p>
                  </div>
                  <QualityHints result={liveQuality} title="Final quality check" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav */}
          <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              onClick={prev}
              disabled={step === 1 || loading}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < 4 ? (
              <Button onClick={next} className="gap-2 px-6 h-11" disabled={!canProceed(step)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading || !canProceed(4)}
                className="gap-2 px-6 h-11 bg-gradient-gold text-accent-foreground hover:opacity-90 shadow-gold border-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Post Task — ${price}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
