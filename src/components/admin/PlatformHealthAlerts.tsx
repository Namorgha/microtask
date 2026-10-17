import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react";
import { generatePlatformHealthAlerts, type AlertSeverity, type HealthAlert } from "@/lib/healthAlerts";
import { formatDistanceToNow } from "date-fns";

const sevStyle: Record<AlertSeverity, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

export default function PlatformHealthAlerts({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-health-alerts"],
    queryFn: async () => {
      const [tasks, payments, verifications, profiles] = await Promise.all([
        supabase.from("tasks").select("id,title,status,poster_id,doer_id,created_at,updated_at"),
        supabase.from("payments").select("id,task_id,payer_id,payee_id,amount,status,created_at,updated_at"),
        supabase.from("verification_requests").select("*"),
        supabase.from("profiles").select("user_id,banned_at,identity_verified,identity_verified_at,address_verified,address_verified_at,updated_at"),
      ]);
      return generatePlatformHealthAlerts({
        tasks: tasks.data ?? [],
        payments: payments.data ?? [],
        verifications: verifications.data ?? [],
        profiles: profiles.data ?? [],
      });
    },
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Platform Health Alerts</CardTitle>
        </div>
        {data && data.length > 0 && (
          <Badge variant="secondary">{data.length} active</Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !data || data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {data.slice(0, 12).map((a) => (
              <AlertRow key={a.id} alert={a} onNavigate={onNavigate} />
            ))}
            {data.length > 12 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{data.length - 12} more alerts
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertRow({ alert, onNavigate }: { alert: HealthAlert; onNavigate?: (tab: string) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Badge variant="outline" className={`capitalize ${sevStyle[alert.severity]}`}>{alert.severity}</Badge>
          <Badge variant="outline" className="capitalize">{alert.type}</Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm font-medium">{alert.title}</p>
        <p className="text-sm text-muted-foreground">{alert.description}</p>
        {alert.recommended && (
          <p className="text-xs text-muted-foreground mt-1 italic">→ {alert.recommended}</p>
        )}
      </div>
      <Button size="sm" variant="outline" className="shrink-0" onClick={() => onNavigate?.(alert.actionTarget)}>
        {alert.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <p className="font-medium">No urgent platform issues found</p>
      <p className="text-sm text-muted-foreground mt-1">Everything looks healthy right now.</p>
    </div>
  );
}