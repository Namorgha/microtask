import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, XCircle, Eye, AlertCircle, ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Status = "pending" | "approved" | "rejected" | "needs_more_info" | "revoked";

export default function AdminVerifications({ adminId }: { adminId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>("pending");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [decisionMode, setDecisionMode] = useState<"reject" | "needs_more_info" | "revoke" | null>(null);
  const [reason, setReason] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-verifications", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_requests")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const userIds = [...new Set(rows.map((r: any) => r.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-verif-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const profMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p]));

  const sign = async (path: string) => {
    if (signedUrls[path]) return signedUrls[path];
    const { data, error } = await supabase.storage.from("verification-documents").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      toast({ title: "Could not load document", description: error?.message ?? "Unknown error", variant: "destructive" });
      return null;
    }
    setSignedUrls((m) => ({ ...m, [path]: data.signedUrl }));
    return data.signedUrl;
  };

  const log = async (action: string, requestId: string) => {
    await supabase.from("activity_logs").insert({ admin_id: adminId, action, target_type: "verification_request", target_id: requestId });
  };

  const notifyUser = async (userId: string, type: string, title: string, message: string) => {
    await supabase.from("notifications").insert({ user_id: userId, type, title, message });
  };

  const deleteDocs = async (req: any) => {
    const paths = [req.document_url, req.selfie_url, req.address_document_url].filter(Boolean) as string[];
    if (paths.length === 0) return;
    await supabase.storage.from("verification-documents").remove(paths);
  };

  const decide = useMutation({
    mutationFn: async ({ req, status, reason }: { req: any; status: Status; reason?: string }) => {
      const update: any = { status, reviewed_by: adminId, reviewed_at: new Date().toISOString() };
      if (status === "rejected" || status === "needs_more_info" || status === "revoked") update.rejection_reason = reason || null;
      const { error } = await supabase.from("verification_requests").update(update).eq("id", req.id);
      if (error) throw error;
      await log(`verification_${status}`, req.id);

      const titles: Record<string, string> = {
        approved: "Verification approved",
        rejected: "Verification rejected",
        needs_more_info: "More information needed",
        revoked: "Verification revoked",
      };
      const messages: Record<string, string> = {
        approved: req.verification_type === "identity" ? "You are now Verified Citizen." : "Your address has been confirmed.",
        rejected: reason ? `Your ${req.verification_type} verification was rejected: ${reason}` : `Your ${req.verification_type} verification was rejected.`,
        needs_more_info: reason ? `Please update your ${req.verification_type} request: ${reason}` : `Please provide more information for your ${req.verification_type} verification.`,
        revoked: `Your ${req.verification_type} verification badge has been revoked.`,
      };
      await notifyUser(req.user_id, `verification_${status}`, titles[status], messages[status]);

      // Auto-delete docs after approval (privacy: keep until revoked is the alternative)
      if (status === "approved" || status === "revoked") {
        await deleteDocs(req);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
      setReviewing(null);
      setDecisionMode(null);
      setReason("");
      toast({ title: "Updated" });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const filtered = rows.filter((r: any) => {
    if (!search) return true;
    const p = profMap[r.user_id];
    const s = search.toLowerCase();
    return (p?.full_name || "").toLowerCase().includes(s) || r.user_id.includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="needs_more_info">Needs info</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="revoked">Revoked</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input placeholder="Search by name or user id" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
      </div>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => {
                const p = profMap[r.user_id];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{p?.full_name || r.user_id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{r.verification_type}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{r.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[220px] truncate">{r.rejection_reason || "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => setReviewing(r)} className="gap-1"><Eye className="h-3.5 w-3.5" /> Review</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No requests in this status</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>

      {reviewing && (
        <Dialog open onOpenChange={(o) => { if (!o) { setReviewing(null); setDecisionMode(null); setReason(""); } }}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="capitalize">{reviewing.verification_type} verification</DialogTitle>
              <DialogDescription>
                {profMap[reviewing.user_id]?.full_name || reviewing.user_id} · submitted {format(new Date(reviewing.created_at), "PPp")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <DocumentPreview label="Document" path={reviewing.document_url || reviewing.address_document_url} sign={sign} />
              {reviewing.selfie_url && <DocumentPreview label="Selfie" path={reviewing.selfie_url} sign={sign} />}
              {reviewing.rejection_reason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                  <strong>Previous reason:</strong> {reviewing.rejection_reason}
                </div>
              )}

              {decisionMode && (
                <div className="space-y-2">
                  <Label>{decisionMode === "revoke" ? "Reason for revoking" : "Reason / instructions for the user"}</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={400} rows={3} placeholder="Be clear and respectful…" />
                </div>
              )}
            </div>

            <DialogFooter className="flex-wrap gap-2">
              {reviewing.status === "approved" ? (
                <Button variant="destructive" onClick={() => setDecisionMode("revoke")} className="gap-1.5"><ShieldOff className="h-4 w-4" /> Revoke</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setDecisionMode("needs_more_info")} className="gap-1.5"><AlertCircle className="h-4 w-4" /> Need more info</Button>
                  <Button variant="destructive" onClick={() => setDecisionMode("reject")} className="gap-1.5"><XCircle className="h-4 w-4" /> Reject</Button>
                  <Button onClick={() => decide.mutate({ req: reviewing, status: "approved" })} disabled={decide.isPending} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Approve</Button>
                </>
              )}
              {decisionMode && (
                <Button
                  variant="default"
                  onClick={() => {
                    const status: Status = decisionMode === "reject" ? "rejected" : decisionMode === "needs_more_info" ? "needs_more_info" : "revoked";
                    decide.mutate({ req: reviewing, status, reason });
                  }}
                  disabled={decide.isPending || (!reason && decisionMode !== "needs_more_info")}
                  className="gap-1.5"
                >
                  {decide.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DocumentPreview({ label, path, sign }: { label: string; path: string | null; sign: (p: string) => Promise<string | null> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (!path) return null;
  const isPdf = path.toLowerCase().endsWith(".pdf");

  const load = async () => {
    setLoading(true);
    const u = await sign(path);
    setUrl(u);
    setLoading(false);
  };

  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">{label}</span>
        {!url && (
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} View securely
          </Button>
        )}
      </div>
      {url && (
        isPdf ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Open PDF (10 min link)</a>
        ) : (
          <img src={url} alt={label} className="max-h-80 rounded-md border" />
        )
      )}
    </div>
  );
}