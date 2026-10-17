import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const actionLabels: Record<string, string> = {
  ban_user: "Banned user",
  unban_user: "Unbanned user",
  promote_admin: "Promoted to admin",
  demote_admin: "Demoted from admin",
  delete_user: "Deleted user",
  delete_task: "Deleted task",
  flag_task: "Flagged task",
  unflag_task: "Unflagged task",
  enable_email_verification: "Enabled email verification",
  disable_email_verification: "Disabled email verification",
};

export default function AdminLogs() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Recent Activity</CardTitle></CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No activity yet</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{actionLabels[log.action] || log.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{log.target_type}: {log.target_id?.slice(0, 8)}...</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(log.created_at), "MMM d, h:mm a")}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
