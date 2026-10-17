import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Flag, Ban, Trash2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";

export default function AdminReports({ adminId }: { adminId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-reports", statusFilter],
    queryFn: async () => {
      let q = (supabase as any).from("reports").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const updateReport = useMutation({
    mutationFn: async ({ id, status, action }: { id: string; status: string; action?: string }) => {
      await (supabase as any).from("reports").update({ status }).eq("id", id);
      if (action) {
        await supabase.from("activity_logs").insert({
          admin_id: adminId,
          action,
          target_type: "report",
          target_id: id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast({ title: "Report updated" });
    },
  });

  const banUser = useMutation({
    mutationFn: async ({ userId, reportId }: { userId: string; reportId: string }) => {
      await supabase.from("profiles").update({ banned_at: new Date().toISOString() }).eq("user_id", userId);
      await (supabase as any).from("reports").update({ status: "reviewed" }).eq("id", reportId);
      await supabase.from("activity_logs").insert({
        admin_id: adminId,
        action: "ban_user_from_report",
        target_type: "user",
        target_id: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast({ title: "User banned" });
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{reports.length} reports</Badge>
      </div>

      {reports.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Flag className="h-10 w-10 mx-auto opacity-40 mb-2" />
          <p>No reports found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report: any) => (
            <Card key={report.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={report.status === "pending" ? "default" : "secondary"} className="capitalize">{report.status}</Badge>
                      <Badge variant="outline" className="capitalize">{report.target_type}</Badge>
                      <Badge variant="outline" className="capitalize">{report.reason}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Target: {report.target_id.slice(0, 8)}...</p>
                    {report.details && <p className="text-sm mt-1">{report.details}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(report.created_at), "MMM d, yyyy h:mm a")}</p>
                  </div>
                  {report.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => updateReport.mutate({ id: report.id, status: "dismissed", action: "dismiss_report" })}>
                        <XCircle className="h-4 w-4 mr-1" /> Dismiss
                      </Button>
                      {report.target_type === "user" && (
                        <Button size="sm" variant="destructive" onClick={() => banUser.mutate({ userId: report.target_id, reportId: report.id })}>
                          <Ban className="h-4 w-4 mr-1" /> Ban User
                        </Button>
                      )}
                      {report.target_type === "task" && (
                        <Button size="sm" variant="destructive" onClick={async () => {
                          await supabase.from("tasks").delete().eq("id", report.target_id);
                          updateReport.mutate({ id: report.id, status: "reviewed", action: "delete_task_from_report" });
                        }}>
                          <Trash2 className="h-4 w-4 mr-1" /> Delete Task
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
