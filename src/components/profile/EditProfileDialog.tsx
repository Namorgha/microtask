import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { TASK_CATEGORIES } from "@/components/shared/CategoryBadge";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  skills: string[] | null;
};

const schema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name is too long"),
  headline: z.string().trim().max(80, "Headline is too long").optional().or(z.literal("")),
  bio: z.string().trim().max(500, "Bio must be under 500 characters").optional().or(z.literal("")),
  location: z.string().trim().max(80, "Location is too long").optional().or(z.literal("")),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileRow;
}

export function EditProfileDialog({ open, onOpenChange, profile }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [skills, setSkills] = useState<string[]>(profile.skills ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(profile.full_name ?? "");
      setHeadline(profile.headline ?? "");
      setBio(profile.bio ?? "");
      setLocation(profile.location ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setSkills(profile.skills ?? []);
      setErrors({});
    }
  }, [open, profile]);

  const toggleSkill = (cat: string) => {
    setSkills((prev) => (prev.includes(cat) ? prev.filter((s) => s !== cat) : [...prev, cat].slice(0, 8)));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "File too large", description: "Avatar must be under 3MB.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.user_id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
      toast({ title: "Photo uploaded", description: "Don't forget to save your changes." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleSave = async () => {
    const parsed = schema.safeParse({ full_name: fullName, headline, bio, location });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) next[String(i.path[0])] = i.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          headline: headline.trim() || null,
          bio: bio.trim() || null,
          location: location.trim() || null,
          avatar_url: avatarUrl || null,
          skills,
        })
        .eq("user_id", profile.user_id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Profile updated", description: "Your changes are live." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit your profile</DialogTitle>
          <DialogDescription>Stronger profiles win more tasks. Add a clear photo, headline, and bio.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 ring-2 ring-border">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile" /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-display text-2xl font-bold">
                  {(fullName || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 rounded-full">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => fileInput.current?.click()} disabled={uploading}>
                <Camera className="h-3.5 w-3.5" /> {avatarUrl ? "Change photo" : "Upload photo"}
              </Button>
              {avatarUrl && (
                <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setAvatarUrl("")}>
                  <X className="h-3.5 w-3.5" /> Remove
                </Button>
              )}
              <p className="text-xs text-muted-foreground">JPG or PNG, up to 3MB.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={60} placeholder="e.g. Alex Morgan" />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="headline">Headline</Label>
            <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} placeholder="e.g. Fast local delivery helper" />
            <p className="text-xs text-muted-foreground">{headline.length}/80 — a one-liner about what you do.</p>
            {errors.headline && <p className="text-xs text-destructive">{errors.headline}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} placeholder="e.g. Brooklyn, NY" />
            {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">About you</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={4} placeholder="Tell others what you're good at, your availability, and how you work." />
            <p className="text-xs text-muted-foreground">{bio.length}/500</p>
            {errors.bio && <p className="text-xs text-destructive">{errors.bio}</p>}
          </div>

          <div className="space-y-2">
            <Label>Skills & categories</Label>
            <div className="flex flex-wrap gap-2">
              {TASK_CATEGORIES.map((cat) => {
                const active = skills.includes(cat);
                return (
                  <Badge
                    key={cat}
                    variant={active ? "default" : "outline"}
                    onClick={() => toggleSkill(cat)}
                    className="cursor-pointer capitalize select-none"
                  >
                    {cat}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Pick up to 8 categories you're best at.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || uploading} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
