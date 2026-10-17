import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle, ListTodo, Users, Activity, CheckCircle2 } from "lucide-react";
import { calculateTaskQuality, calculateUserQuality, calculateDealQuality, LEVEL_LABEL, type QualityLevel } from "@/lib/qualityEngine";
import { cn } from "@/lib/utils";

const LEVEL_BADGE: Record<QualityLevel, string> = {
  strong: "bg-success/15 text-success border-success/30",
  good: "bg-primary/15 text-primary border-primary/30",
  new: "bg-muted text-muted-foreground border-border",
  needs_attention: "bg-warning/20 text-warning-foreground border-warning/40",
  restricted: "bg-destructive/15 text-destructive border-destructive/40",
};

function LevelBadge({ level, score }: { level: QualityLevel; score: number }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", LEVEL_BADGE[level])}>
      {LEVEL_LABEL[level]} · {score}
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 text-success" />
      {text}
    </div>
  );
}

export default function AdminQualityEngine() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-quality-engine"],
    queryFn: async () => {
      const [tasksRes, profilesRes, paymentsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, description, category, price, duration, location, lat, lng, images, flagged, status, poster_id, doer_id, created_at, updated_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, bio, location, headline, reputation_score, total_reviews_count, completed_tasks_count, banned_at, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("payments")
          .select("task_id, status, updated_at")
          .order("updated_at", { ascending: false })
          .limit(500),
      ]);

      const tasks = tasksRes.data || [];
      const profiles = profilesRes.data || [];
      const payments = paymentsRes.data || [];

      const profileById: Record<string, any> = {};
      for (const p of profiles) profileById[p.user_id] = p;

      const paymentByTask: Record<string, any> = {};
      for (const pay of payments) if (!paymentByTask[pay.task_id]) paymentByTask[pay.task_id] = pay;

      // Posted/cancelled counts per user
      const postedCounts: Record<string, number> = {};
      const cancelledCounts: Record<string, number> = {};
      for (const t of tasks) {
        postedCounts[t.poster_id] = (postedCounts[t.poster_id] || 0) + 1;
        if (t.status === "cancelled") cancelledCounts[t.poster_id] = (cancelledCounts[t.poster_id] || 0) + 1;
      }

      // Score everything
      const scoredTasks = tasks.map((t) => ({ task: t, q: calculateTaskQuality(t as any) }));
      const lowQualityTasks = scoredTasks
        .filter((x) => x.q.level === "needs_attention" || x.q.level === "restricted" || x.task.flagged)
        .slice(0, 25);

      const scoredUsers = profiles.map((p) => ({
        user: p,
        q: calculateUserQuality({
          ...p,
          posted_tasks_count: postedCounts[p.user_id] || 0,
          cancelled_tasks_count: cancelledCounts[p.user_id] || 0,
        } as any),
      }));
      const usersNeedingAttention = scoredUsers
        .filter((x) => x.q.level === "needs_attention" || x.q.level === "restricted")
        .slice(0, 25);

      // Deal health for active tasks
      const activeStatuses = new Set(["accepted", "funded", "in_progress", "completed"]);
      const scoredDeals = tasks
        .filter((t) => activeStatuses.has(t.status))
        .map((t) => ({
          task: t,
          q: calculateDealQuality({
            task: { status: t.status, created_at: t.created_at, updated_at: t.updated_at },
            payment: paymentByTask[t.id] || null,
            poster: profileById[t.poster_id] || null,
            doer: t.doer_id ? profileById[t.doer_id] || null : null,
          }),
        }));
      const riskyDeals = scoredDeals
        .filter((x) => x.q.level === "needs_attention" || x.q.level === "restricted")
        .slice(0, 25);

      return {
        totals: {
          tasks: tasks.length,
          users: profiles.length,
          activeDeals: scoredDeals.length,
          lowTasks: lowQualityTasks.length,
          flaggedUsers: usersNeedingAttention.length,
          riskyDeals: riskyDeals.length,
        },
        lowQualityTasks,
        usersNeedingAttention,
        riskyDeals,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-display font-semibold">Platform Quality Engine</p>
          <p className="text-muted-foreground">
            Real-time quality signals derived from tasks, profiles, payments, and reports — explainable, deterministic, no black box.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-warning/15 text-warning-foreground flex items-center justify-center"><ListTodo className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">Low-quality tasks</p><p className="font-display text-2xl font-bold">{data.totals.lowTasks}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center"><Users className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">Users needing attention</p><p className="font-display text-2xl font-bold">{data.totals.flaggedUsers}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent/20 text-accent flex items-center justify-center"><Activity className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">Risky active deals</p><p className="font-display text-2xl font-bold">{data.totals.riskyDeals}</p></div>
        </CardContent></Card>
      </div>

      {/* Low-quality tasks */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Low-quality tasks
          </h3>
          {data.lowQualityTasks.length === 0 ? (
            <EmptyHint text="No low-quality tasks detected." />
          ) : (
            <div className="divide-y divide-border/60">
              {data.lowQualityTasks.map(({ task, q }) => (
                <Link to={`/tasks/${task.id}`} key={task.id} className="flex items-start justify-between gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {q.warnings[0] || "See details"} · {task.status}
                    </p>
                  </div>
                  <LevelBadge level={q.level} score={q.score} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users needing attention */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-destructive" /> Users needing attention
          </h3>
          {data.usersNeedingAttention.length === 0 ? (
            <EmptyHint text="No flagged users right now." />
          ) : (
            <div className="divide-y divide-border/60">
              {data.usersNeedingAttention.map(({ user, q }) => (
                <Link to={`/profile/${user.user_id}`} key={user.user_id} className="flex items-start justify-between gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.full_name || "Unnamed user"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{q.warnings[0] || "Quality below threshold"}</p>
                  </div>
                  <LevelBadge level={q.level} score={q.score} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risky deals */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" /> Risky active deals
          </h3>
          {data.riskyDeals.length === 0 ? (
            <EmptyHint text="All active deals look healthy." />
          ) : (
            <div className="divide-y divide-border/60">
              {data.riskyDeals.map(({ task, q }) => (
                <Link to={`/tasks/${task.id}`} key={task.id} className="flex items-start justify-between gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{q.warnings[0] || "Needs review"} · {task.status}</p>
                  </div>
                  <LevelBadge level={q.level} score={q.score} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
