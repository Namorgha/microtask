import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ReportDialogProps {
  targetType: "task" | "user";
  targetId: string;
  triggerLabel?: string;
}

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "fraud", label: "Fraud / Scam" },
  { value: "other", label: "Other" },
];

export function ReportDialog({ targetType, targetId, triggerLabel }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }
    if (!reason) {
      toast({ title: "Please select a reason", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await (supabase as any).from("reports").insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Report Submitted", description: "We'll review this shortly." });
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Flag className="h-4 w-4" />
          {triggerLabel || "Report"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {targetType === "task" ? "Task" : "User"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Details (optional)</Label>
            <Textarea placeholder="Provide additional details..." value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={3} />
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
