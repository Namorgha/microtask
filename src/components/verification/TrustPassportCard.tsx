import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, MapPin, Mail, BadgeCheck, Clock, AlertCircle, Lock, Upload, Loader2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Profile = {
  user_id: string;
  identity_verified?: boolean | null;
  address_verified?: boolean | null;
};

type Req = {
  id: string;
  user_id: string;
  verification_type: "identity" | "address";
  status: "pending" | "approved" | "rejected" | "needs_more_info" | "revoked";
  rejection_reason: string | null;
  admin_notes: string | null;
  created_at: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 8 * 1024 * 1024;

export function TrustPassportCard({ profile, isOwner, emailVerified }: { profile: Profile; isOwner: boolean; emailVerified: boolean | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openType, setOpenType] = useState<"identity" | "address" | null>(null);

  const { data: requests = [] } = useQuery({
    queryKey: ["verification-requests", profile.user_id, isOwner],
    queryFn: async () => {
      if (!isOwner) return [];
      const { data, error } = await supabase
        .from("verification_requests")
        .select("*")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Req[];
    },
    enabled: isOwner,
  });

  const latest = (type: "identity" | "address") => requests.find((r) => r.verification_type === type);

  const tiers = useMemo(() => {
    const arr: Array<{ key: string; label: string; status: string; tone: string; icon: any; sub?: string }> = [];
    arr.push({
      key: "email",
      label: "Email verified",
      status: emailVerified ? "approved" : isOwner ? "missing" : "private",
      tone: emailVerified ? "primary" : "muted",
      icon: Mail,
    });
    const idLatest = latest("identity");
    arr.push({
      key: "identity",
      label: "Verified Citizen",
      status: profile.identity_verified ? "approved" : idLatest?.status ?? "missing",
      tone: profile.identity_verified ? "primary" : "muted",
      icon: ShieldCheck,
      sub: profile.identity_verified ? "Identity confirmed" : idLatest?.status === "pending" ? "Under admin review" : idLatest?.status === "rejected" ? `Rejected${idLatest.rejection_reason ? `: ${idLatest.rejection_reason}` : ""}` : idLatest?.status === "needs_more_info" ? "More info requested" : isOwner ? "Not started" : "Not verified",
    });
    const addrLatest = latest("address");
    arr.push({
      key: "address",
      label: "Address Confirmed",
      status: profile.address_verified ? "approved" : addrLatest?.status ?? "missing",
      tone: profile.address_verified ? "blue" : "muted",
      icon: MapPin,
      sub: profile.address_verified ? "Address confirmed" : addrLatest?.status === "pending" ? "Under admin review" : addrLatest?.status === "rejected" ? `Rejected${addrLatest.rejection_reason ? `: ${addrLatest.rejection_reason}` : ""}` : addrLatest?.status === "needs_more_info" ? "More info requested" : isOwner ? "Optional" : "Not verified",
    });
    return arr;
  }, [profile, requests, emailVerified, isOwner]);

  const canSubmit = (type: "identity" | "address") => {
    if (type === "identity" && profile.identity_verified) return false;
    if (type === "address" && profile.address_verified) return false;
    const cur = latest(type);
    if (cur && (cur.status === "pending" || cur.status === "needs_more_info")) return false;
    return true;
  };

  return (
    <Card className="shadow-card border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <BadgeCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Trust Passport</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {isOwner ? "Verify your identity to earn trust badges. Documents are private and only reviewed by admins." : "Verification status reviewed by platform admins."}
        </p>

        <ul className="space-y-3">
          {tiers.map((t) => {
            const Icon = t.icon;
            const approved = t.status === "approved";
            const pending = t.status === "pending" || t.status === "needs_more_info";
            const rejected = t.status === "rejected";
            return (
              <li key={t.key} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3">
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  approved && t.tone === "primary" && "bg-primary/10 text-primary",
                  approved && t.tone === "blue" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                  !approved && "bg-muted text-muted-foreground",
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{t.label}</span>
                    {approved && <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30 text-[10px]"><ShieldCheck className="h-2.5 w-2.5" /> Approved</Badge>}
                    {pending && <Badge variant="outline" className="gap-1 bg-accent/15 text-accent border-accent/30 text-[10px]"><Clock className="h-2.5 w-2.5" /> Pending</Badge>}
                    {rejected && <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30 text-[10px]"><AlertCircle className="h-2.5 w-2.5" /> Rejected</Badge>}
                  </div>
                  {t.sub && <p className="text-xs text-muted-foreground mt-0.5">{t.sub}</p>}
                </div>
                {isOwner && (t.key === "identity" || t.key === "address") && canSubmit(t.key as any) && (
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setOpenType(t.key as any)}>
                    <Upload className="h-3.5 w-3.5" /> {rejected ? "Resubmit" : "Verify"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        {isOwner && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Your documents are stored privately. Other users only see your verification badge — never the documents themselves.</span>
          </div>
        )}
      </CardContent>

      {openType && (
        <VerifyDialog
          type={openType}
          userId={profile.user_id}
          onClose={() => setOpenType(null)}
          onSubmitted={() => qc.invalidateQueries({ queryKey: ["verification-requests", profile.user_id, isOwner] })}
        />
      )}
    </Card>
  );
}

function VerifyDialog({ type, userId, onClose, onSubmitted }: { type: "identity" | "address"; userId: string; onClose: () => void; onSubmitted: () => void }) {
  const { toast } = useToast();
  const [doc, setDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (type === "identity" && (!doc || !selfie)) throw new Error("Please upload your ID document and a selfie.");
      if (type === "address" && !doc) throw new Error("Please upload your address proof document.");
      for (const f of [doc, selfie].filter(Boolean) as File[]) {
        if (f.size > MAX_BYTES) throw new Error(`${f.name} is too large (max 8MB).`);
        if (!ACCEPT.split(",").includes(f.type)) throw new Error(`${f.name} has an unsupported format.`);
      }
      const ts = Date.now();
      const ext = (f: File) => (f.type === "application/pdf" ? "pdf" : f.type.split("/")[1] || "jpg");
      const upload = async (f: File, label: string) => {
        const path = `${userId}/${type}/${ts}-${label}.${ext(f)}`;
        const { error } = await supabase.storage.from("verification-documents").upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type,
        });
        if (error) throw error;
        return path;
      };

      const payload: any = { user_id: userId, verification_type: type, status: "pending" };
      if (type === "identity") {
        payload.document_url = await upload(doc!, "id");
        payload.selfie_url = await upload(selfie!, "selfie");
      } else {
        payload.address_document_url = await upload(doc!, "address");
      }
      const { error } = await supabase.from("verification_requests").insert(payload);
      if (error) {
        if (error.code === "23505") throw new Error("You already have a pending request of this type.");
        throw error;
      }
      // self-notify
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "verification_submitted",
        title: "Verification submitted",
        message: type === "identity" ? "Your identity verification is under admin review." : "Your address verification is under admin review.",
        data: { kind: type },
      });
    },
    onSuccess: () => {
      toast({ title: "Submitted", description: "Your request is under admin review." });
      onSubmitted();
      onClose();
    },
    onError: (e: any) => toast({ title: "Submission failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{type === "identity" ? "Verify your identity" : "Verify your address"}</DialogTitle>
          <DialogDescription>
            {type === "identity"
              ? "Upload a clear photo of your CIN or passport and a real-time selfie. An admin will review your request."
              : "Upload a recent utility bill or official document showing your name and address. An admin will review your request."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{type === "identity" ? "ID document (CIN / Passport)" : "Address proof document"}</Label>
            <input
              type="file"
              accept={ACCEPT}
              onChange={(e) => setDoc(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:px-3 file:py-1.5 file:font-medium"
            />
            {doc && <p className="text-xs text-muted-foreground">{doc.name} · {(doc.size / 1024).toFixed(0)} KB</p>}
          </div>

          {type === "identity" && (
            <div className="space-y-1.5">
              <Label>Selfie (real-time photo of your face)</Label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:px-3 file:py-1.5 file:font-medium"
              />
              {selfie && <p className="text-xs text-muted-foreground">{selfie.name} · {(selfie.size / 1024).toFixed(0)} KB</p>}
            </div>
          )}

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex gap-2">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Documents are stored privately and only used to verify your account. Only admins can view them. Other users only see your verification badge.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submit.isPending}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="gap-1.5">
            {submit.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Submit for review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}