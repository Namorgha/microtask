import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Users,
  ListTodo,
  BarChart3,
  DollarSign,
  BadgeCheck,
  Flag,
  Settings,
  ScrollText,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import PlatformHealthAlerts from "./PlatformHealthAlerts";
import { format } from "date-fns";

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold font-display">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard({
  onNavigate,
}: { onNavigate?: (tab: string) => void } = {}) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [
        usersRes,
        tasksRes,
        activeRes,
        pendingPayRes,
        pendingVerifRes,
        openReportsRes,
        revenueRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "accepted", "in_progress"]),
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("verification_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        (supabase as any)
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("payments")
          .select("amount, platform_fee")
          .eq("status", "completed"),
      ]);
      let totalRevenue = 0;
      try {
        const revenueData = revenueRes?.data ?? null;
        if (!revenueData) {
          console.warn(
            "AdminDashboard: revenue query returned no data",
            revenueRes?.error,
          );
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("payments")
            .select("platform_fee")
            .eq("status", "completed");
          if (fallbackError) {
            console.error(
              "AdminDashboard: fallback revenue query failed",
              fallbackError,
            );
          } else {
            totalRevenue = (fallbackData ?? []).reduce(
              (sum: number, p: any) => sum + Number(p.platform_fee || 0),
              0,
            );
          }
        } else {
          totalRevenue = revenueData.reduce(
            (sum: number, p: any) => sum + Number(p.platform_fee || 0),
            0,
          );
        }
      } catch (e) {
        console.error("AdminDashboard: error calculating totalRevenue", e);
        totalRevenue = 0;
      }
      return {
        totalUsers: usersRes.count ?? 0,
        totalTasks: tasksRes.count ?? 0,
        activeTasks: activeRes.count ?? 0,
        pendingPayments: pendingPayRes.count ?? 0,
        pendingVerifications: pendingVerifRes.count ?? 0,
        openReports: openReportsRes.error ? 0 : (openReportsRes.count ?? 0),
        totalRevenue,
      };
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["admin-recent-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  const quickActions: { label: string; icon: React.ReactNode; tab: string }[] =
    [
      {
        label: "Manage Users",
        icon: <Users className="h-4 w-4" />,
        tab: "users",
      },
      {
        label: "Review Tasks",
        icon: <ListTodo className="h-4 w-4" />,
        tab: "tasks",
      },
      {
        label: "Check Payments",
        icon: <CreditCard className="h-4 w-4" />,
        tab: "payments",
      },
      {
        label: "Review Reports",
        icon: <Flag className="h-4 w-4" />,
        tab: "reports",
      },
      {
        label: "Review Verifications",
        icon: <BadgeCheck className="h-4 w-4" />,
        tab: "verifications",
      },
      {
        label: "Quality Engine",
        icon: <ShieldCheck className="h-4 w-4" />,
        tab: "quality",
      },
      {
        label: "Platform Settings",
        icon: <Settings className="h-4 w-4" />,
        tab: "settings",
      },
      {
        label: "Activity Logs",
        icon: <ScrollText className="h-4 w-4" />,
        tab: "logs",
      },
    ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Total Users"
          value={stats?.totalUsers ?? 0}
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Active Tasks"
          value={stats?.activeTasks ?? 0}
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Pending Payments"
          value={stats?.pendingPayments ?? 0}
        />
        <StatCard
          icon={<BadgeCheck className="h-5 w-5" />}
          label="Pending Verifications"
          value={stats?.pendingVerifications ?? 0}
        />
        <StatCard
          icon={<Flag className="h-5 w-5" />}
          label="Open Reports"
          value={stats?.openReports ?? 0}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Platform Revenue"
          value={`$${(stats?.totalRevenue ?? 0).toFixed(2)}`}
        />
      </div>

      <PlatformHealthAlerts onNavigate={onNavigate} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {quickActions.map((a) => (
              <Button
                key={a.tab}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => onNavigate?.(a.tab)}
              >
                <span className="text-primary">{a.icon}</span>
                <span className="truncate">{a.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigate?.("logs")}
          >
            View all
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No recent admin activity yet.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((l: any) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(l.action || "").replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {l.target_type}: {String(l.target_id ?? "").slice(0, 8)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(l.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
