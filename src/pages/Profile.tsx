import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StarRating } from "@/components/shared/StarRating";
import { ReportDialog } from "@/components/shared/ReportDialog";
import { EditProfileDialog } from "@/components/profile/EditProfileDialog";
import { TrustPassportCard } from "@/components/verification/TrustPassportCard";
import { VerifiedBadges } from "@/components/verification/VerifiedBadge";
import {
  MapPin, Calendar, Edit, Star, CheckCircle2, ShieldCheck, Mail, BadgeCheck, Sparkles,
  Activity, Briefcase, ListChecks, ArrowRight, AlertCircle, ShieldAlert, ThumbsUp,
  TrendingUp, TrendingDown, Wallet, Receipt, DollarSign, Send, Inbox,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Stat = { label: string; value: string | number; hint?: string; icon: any };

function StatCard({ s }: { s: Stat }) {
  const Icon = s.icon;
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" />
          {s.label}
        </div>
        <p className="mt-2 font-display text-2xl font-bold tracking-tight">{s.value}</p>
        {s.hint && <p className="text-xs text-muted-foreground mt-0.5">{s.hint}</p>}
      </CardContent>
    </Card>
  );
}

function StrengthLabel({ score }: { score: number }) {
  const meta =
    score >= 80
      ? { label: "Strong profile", cls: "bg-primary/15 text-primary border-primary/30" }
      : score >= 50
      ? { label: "Good profile", cls: "bg-accent/15 text-accent border-accent/30" }
      : { label: "New profile", cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", meta.cls)}>
      <Sparkles className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const targetId = routeUserId || user?.id;
  const isOwner = !!user && !!targetId && user.id === targetId;
  const [editOpen, setEditOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", targetId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", targetId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!targetId,
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["profile-reviews", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewee_id", targetId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const ids = [...new Set((data || []).map((r: any) => r.reviewer_id))];
      let map: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", ids);
        map = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p]));
      }
      return (data || []).map((r: any) => ({ ...r, reviewer: map[r.reviewer_id] || null }));
    },
    enabled: !!targetId,
  });

  // Tasks: posted + done-as-doer (used for activity + completion/cancel rates)
  const { data: postedTasks = [] } = useQuery({
    queryKey: ["profile-posted", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, category, price, created_at")
        .eq("poster_id", targetId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!targetId,
  });

  const { data: doneTasks = [] } = useQuery({
    queryKey: ["profile-done", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, category, price, updated_at")
        .eq("doer_id", targetId!)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!targetId,
  });

  // Owner-only: requests this user has made (as a doer)
  const { data: myRequests = [] } = useQuery({
    queryKey: ["profile-requests", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_applications")
        .select("id, status, message, created_at, task:tasks!task_applications_task_id_fkey(id, title, status, price)")
        .eq("doer_id", targetId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!targetId && isOwner,
  });

  // Owner-only: payment records (as payer or payee)
  const { data: payments = [] } = useQuery({
    queryKey: ["profile-payments", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, task:tasks!payments_task_id_fkey(id, title)")
        .or(`payer_id.eq.${targetId},payee_id.eq.${targetId}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!targetId && isOwner,
  });

  // Owner-only: email verification status
  const emailVerified = isOwner ? !!user?.email_confirmed_at : null;

  const stats = useMemo(() => {
    const doerCompleted = doneTasks.filter((t) => t.status === "completed" || t.status === "paid").length;
    const completed = profile?.completed_tasks_count ?? doerCompleted;
    const posted = postedTasks.length;
    const postedCompleted = postedTasks.filter((t) => t.status === "completed" || t.status === "paid").length;
    const postedCancelled = postedTasks.filter((t) => t.status === "cancelled").length;
    const rating = Number(profile?.reputation_score ?? 0);
    const totalReviews = profile?.total_reviews_count ?? reviews.length;

    const doerTotal = doneTasks.length;
    const doerCancelled = doneTasks.filter((t) => t.status === "cancelled").length;
    const completionRate = doerTotal > 0 ? Math.round((doerCompleted / doerTotal) * 100) : null;
    const cancellationRate = doerTotal > 0 ? Math.round((doerCancelled / doerTotal) * 100) : null;

    return { completed, posted, postedCompleted, postedCancelled, rating, totalReviews, completionRate, cancellationRate, doerTotal };
  }, [profile, postedTasks, doneTasks, reviews]);

  // Financial summary (real, derived from payments + tasks)
  const finance = useMemo(() => {
    const earnedRows = payments.filter((p: any) => p.payee_id === targetId && (p.status === "released" || p.status === "escrow"));
    const spentRows = payments.filter((p: any) => p.payer_id === targetId && (p.status === "released" || p.status === "escrow"));
    const totalEarned = earnedRows
      .filter((p: any) => p.status === "released")
      .reduce((s: number, p: any) => s + (Number(p.amount) - Number(p.platform_fee || 0)), 0);
    const totalSpent = spentRows
      .filter((p: any) => p.status === "released")
      .reduce((s: number, p: any) => s + Number(p.amount), 0);
    const feesPaid = spentRows
      .filter((p: any) => p.status === "released")
      .reduce((s: number, p: any) => s + Number(p.platform_fee || 0), 0);
    const inEscrowOut = spentRows.filter((p: any) => p.status === "escrow").reduce((s: number, p: any) => s + Number(p.amount), 0);
    const inEscrowIn = earnedRows.filter((p: any) => p.status === "escrow").reduce((s: number, p: any) => s + (Number(p.amount) - Number(p.platform_fee || 0)), 0);
    const paidEarnedCount = earnedRows.filter((p: any) => p.status === "released").length;
    const paidSpentCount = spentRows.filter((p: any) => p.status === "released").length;
    const avgEarn = paidEarnedCount > 0 ? totalEarned / paidEarnedCount : 0;
    const avgSpend = paidSpentCount > 0 ? totalSpent / paidSpentCount : 0;
    return { totalEarned, totalSpent, feesPaid, inEscrowOut, inEscrowIn, paidEarnedCount, paidSpentCount, avgEarn, avgSpend };
  }, [payments, targetId]);

  const profileStrength = useMemo(() => {
    if (!profile) return { score: 0, items: [] as { label: string; done: boolean }[] };
    const items = [
      { label: "Add a profile photo", done: !!profile.avatar_url },
      { label: "Set your full name", done: !!(profile.full_name && profile.full_name.length >= 2) },
      { label: "Write a headline", done: !!profile.headline },
      { label: "Complete your bio (50+ chars)", done: !!profile.bio && profile.bio.length >= 50 },
      { label: "Add your location", done: !!profile.location },
      { label: "Pick at least 2 skills", done: (profile.skills?.length ?? 0) >= 2 },
      { label: "Verify your email", done: isOwner ? !!emailVerified : true },
    ];
    const score = Math.round((items.filter((i) => i.done).length / items.length) * 100);
    return { score, items };
  }, [profile, emailVerified, isOwner]);

  const trustReasons = useMemo(() => {
    const r: string[] = [];
    if (stats.rating >= 4.5 && stats.totalReviews >= 3) r.push("Highly rated by other users");
    if (stats.completed >= 5) r.push(`${stats.completed} tasks completed successfully`);
    if (emailVerified) r.push("Verified email address");
    if (profileStrength.score >= 80) r.push("Complete, detailed profile");
    if (stats.completionRate !== null && stats.completionRate >= 90) r.push(`${stats.completionRate}% completion rate`);
    if (r.length === 0) r.push("New user, still building trust");
    return r.slice(0, 3);
  }, [stats, emailVerified, profileStrength]);

  const ratingBreakdown = useMemo(() => {
    const buckets = [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: reviews.filter((r: any) => r.rating === n).length }));
    const total = reviews.length || 1;
    return buckets.map((b) => ({ ...b, pct: Math.round((b.count / total) * 100) }));
  }, [reviews]);

  // Auth gate (only if no userId in route AND not signed in)
  if (!targetId) {
    return (
      <div className="container py-16 text-center">
        <p className="text-muted-foreground mb-4">Sign in to view your profile</p>
        <Link to="/auth"><Button>Sign In</Button></Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-5xl py-6 space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container py-16 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h1 className="font-display text-xl font-semibold">Profile not found</h1>
        <p className="text-muted-foreground mt-1">This user may have removed their account.</p>
        <Link to="/tasks" className="inline-block mt-4"><Button variant="outline">Browse tasks</Button></Link>
      </div>
    );
  }

  const initial = (profile.full_name || "?").charAt(0).toUpperCase();
  const memberSince = profile.created_at ? format(new Date(profile.created_at), "MMM yyyy") : "—";

  return (
    <div className="container max-w-5xl py-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
        {/* HEADER */}
        <Card className="overflow-hidden shadow-card">
          <div className="h-24 bg-gradient-hero relative" />
          <CardContent className="p-6 -mt-12">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <Avatar className="h-24 w-24 ring-4 ring-card shadow-elevated shrink-0">
                {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.full_name || "Profile"} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-display text-3xl font-bold">{initial}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold truncate">{profile.full_name || "Unnamed user"}</h1>
                  <StrengthLabel score={profileStrength.score} />
                  <VerifiedBadges identityVerified={profile.identity_verified} addressVerified={profile.address_verified} />
                  {profile.banned_at && (
                    <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Restricted</Badge>
                  )}
                </div>
                {profile.headline ? (
                  <p className="text-sm sm:text-base text-foreground/80 mt-1">{profile.headline}</p>
                ) : isOwner ? (
                  <p className="text-sm text-muted-foreground italic mt-1">Add a headline so others know what you do.</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  {profile.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.location}</span>}
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Member since {memberSince}</span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                    {stats.totalReviews > 0 ? `${stats.rating.toFixed(1)} · ${stats.totalReviews} reviews` : "No reviews yet"}
                  </span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />{stats.completed} done</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                {isOwner ? (
                  <Button onClick={() => setEditOpen(true)} className="gap-1.5"><Edit className="h-3.5 w-3.5" /> Edit profile</Button>
                ) : (
                  <>
                    <Link to="/tasks"><Button variant="outline" size="sm" className="gap-1.5"><Briefcase className="h-3.5 w-3.5" /> View tasks</Button></Link>
                    {user && <ReportDialog targetType="user" targetId={profile.user_id} triggerLabel="Report user" />}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QUICK STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard s={{ label: "Tasks done", value: stats.completed, icon: CheckCircle2 }} />
          <StatCard s={{ label: "Tasks posted", value: stats.posted, icon: Briefcase }} />
          <StatCard s={{ label: "Avg rating", value: stats.totalReviews > 0 ? stats.rating.toFixed(1) : "—", hint: `${stats.totalReviews} reviews`, icon: Star }} />
          <StatCard s={{ label: "Completion", value: stats.completionRate !== null ? `${stats.completionRate}%` : "—", hint: stats.cancellationRate !== null ? `${stats.cancellationRate}% cancelled` : "No history yet", icon: ListChecks }} />
        </div>

        {/* FINANCIAL SUMMARY (owner only) */}
        {isOwner && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-card border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wide">
                  <TrendingUp className="h-3.5 w-3.5" /> Total earned
                </div>
                <p className="font-display text-3xl font-bold mt-2 tabular-nums">${finance.totalEarned.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  From {finance.paidEarnedCount} paid {finance.paidEarnedCount === 1 ? "task" : "tasks"} · avg ${finance.avgEarn.toFixed(2)}
                </p>
                {finance.inEscrowIn > 0 && (
                  <p className="text-xs text-accent mt-1">+ ${finance.inEscrowIn.toFixed(2)} pending in escrow</p>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-foreground/70 text-xs font-semibold uppercase tracking-wide">
                  <TrendingDown className="h-3.5 w-3.5" /> Total spent
                </div>
                <p className="font-display text-3xl font-bold mt-2 tabular-nums">${finance.totalSpent.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {finance.paidSpentCount} paid {finance.paidSpentCount === 1 ? "task" : "tasks"} · avg ${finance.avgSpend.toFixed(2)}
                </p>
                {finance.inEscrowOut > 0 && (
                  <p className="text-xs text-accent mt-1">${finance.inEscrowOut.toFixed(2)} held in escrow</p>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-foreground/70 text-xs font-semibold uppercase tracking-wide">
                  <Receipt className="h-3.5 w-3.5" /> Platform fees
                </div>
                <p className="font-display text-3xl font-bold mt-2 tabular-nums">${finance.feesPaid.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Total fees paid on completed tasks</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* EXTENDED ACTIVITY STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard s={{ label: "Posted (done)", value: stats.postedCompleted, hint: `${stats.postedCancelled} cancelled`, icon: Send }} />
          <StatCard s={{ label: "Worked on", value: stats.doerTotal, hint: `${stats.completed} completed`, icon: Inbox }} />
          {isOwner && <StatCard s={{ label: "Requests sent", value: myRequests.length, hint: `${myRequests.filter((r:any) => r.status === "accepted").length} accepted`, icon: Briefcase }} />}
          <StatCard s={{ label: "Member since", value: memberSince, icon: Calendar }} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* ABOUT */}
            <Card className="shadow-card">
              <CardContent className="p-6">
                <h2 className="font-display text-lg font-semibold mb-3">About</h2>
                {profile.bio ? (
                  <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{profile.bio}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {isOwner ? "Add a bio so others know what you do best." : "This user hasn't written a bio yet."}
                  </p>
                )}

                {profile.skills && profile.skills.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Skills & categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill: string) => (
                        <Badge key={skill} variant="secondary" className="capitalize">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* REVIEWS */}
            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-semibold">Reviews</h2>
                  {stats.totalReviews > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Star className="h-4 w-4 fill-accent text-accent" />
                      <span className="font-semibold">{stats.rating.toFixed(1)}</span>
                      <span className="text-muted-foreground">({stats.totalReviews})</span>
                    </div>
                  )}
                </div>

                {reviews.length > 0 ? (
                  <>
                    {/* Breakdown */}
                    <div className="space-y-1.5 mb-5 pb-5 border-b">
                      {ratingBreakdown.map((b) => (
                        <div key={b.stars} className="flex items-center gap-3 text-xs">
                          <span className="w-8 text-muted-foreground">{b.stars}★</span>
                          <Progress value={b.pct} className="h-1.5 flex-1" />
                          <span className="w-8 text-right text-muted-foreground tabular-nums">{b.count}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-5">
                      {reviews.slice(0, 8).map((review: any) => {
                        const r = review.reviewer;
                        return (
                          <div key={review.id} className="flex gap-3">
                            <Avatar className="h-9 w-9 shrink-0">
                              {r?.avatar_url ? <AvatarImage src={r.avatar_url} alt={r?.full_name || "Reviewer"} /> : null}
                              <AvatarFallback className="bg-muted text-xs font-medium">{(r?.full_name || "?").charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <Link to={r?.user_id ? `/profile/${r.user_id}` : "#"} className="font-medium text-sm hover:underline truncate">
                                  {r?.full_name || "User"}
                                </Link>
                                <span className="text-xs text-muted-foreground">{format(new Date(review.created_at), "MMM d, yyyy")}</span>
                              </div>
                              <StarRating rating={review.rating} size="sm" />
                              {review.text && <p className="text-sm text-foreground/85 mt-1 leading-relaxed">{review.text}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : reviewsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Star className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {isOwner ? "No reviews yet — complete tasks to build trust." : "No reviews yet."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* HISTORY */}
            <Card className="shadow-card">
              <CardContent className="p-6">
                <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> History
                </h2>
                <Tabs defaultValue="posted">
                  <TabsList className={`w-full grid h-auto gap-1 ${isOwner ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
                    <TabsTrigger value="posted" className="text-xs">Posted ({postedTasks.length})</TabsTrigger>
                    <TabsTrigger value="done" className="text-xs">Completed ({doneTasks.length})</TabsTrigger>
                    {isOwner && <TabsTrigger value="requests" className="text-xs">Requests ({myRequests.length})</TabsTrigger>}
                    {isOwner && <TabsTrigger value="payments" className="text-xs">Payments ({payments.length})</TabsTrigger>}
                  </TabsList>

                  <TabsContent value="posted" className="mt-4">
                    {postedTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No tasks posted yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {postedTasks.slice(0, 15).map((t: any) => (
                          <li key={t.id}>
                            <Link to={`/tasks/${t.id}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Send className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{t.title}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {t.status.replace("_", " ")} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                                </p>
                              </div>
                              <span className="text-sm font-semibold tabular-nums shrink-0">${Number(t.price).toFixed(0)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="done" className="mt-4">
                    {doneTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No completed work yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {doneTasks.slice(0, 15).map((t: any) => {
                          const isPaid = t.status === "paid";
                          return (
                            <li key={t.id}>
                              <Link to={`/tasks/${t.id}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                                <div className="h-8 w-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
                                  <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{t.title}</p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {t.status.replace("_", " ")} · {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                                  </p>
                                </div>
                                <span className={cn("text-sm font-semibold tabular-nums shrink-0", isPaid ? "text-primary" : "")}>
                                  {isPaid ? "+" : ""}${Number(t.price).toFixed(0)}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </TabsContent>

                  {isOwner && (
                    <TabsContent value="requests" className="mt-4">
                      {myRequests.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">You haven't requested any tasks yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {myRequests.slice(0, 15).map((r: any) => {
                            const cls =
                              r.status === "accepted" ? "bg-primary/10 text-primary border-primary/30" :
                              r.status === "rejected" ? "bg-destructive/10 text-destructive border-destructive/30" :
                              "bg-muted text-muted-foreground border-border";
                            return (
                              <li key={r.id}>
                                <Link to={r.task ? `/tasks/${r.task.id}` : "#"} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                                  <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                                    <Briefcase className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                      {r.task?.title || "Task removed"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                                    </p>
                                  </div>
                                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0", cls)}>
                                    {r.status}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </TabsContent>
                  )}

                  {isOwner && (
                    <TabsContent value="payments" className="mt-4">
                      {payments.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No payment history yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {payments.slice(0, 20).map((p: any) => {
                            const incoming = p.payee_id === targetId;
                            const net = incoming ? Number(p.amount) - Number(p.platform_fee || 0) : Number(p.amount);
                            const statusCls =
                              p.status === "released" ? "bg-primary/10 text-primary border-primary/30" :
                              p.status === "escrow" ? "bg-accent/15 text-accent border-accent/30" :
                              p.status === "refunded" ? "bg-destructive/10 text-destructive border-destructive/30" :
                              "bg-muted text-muted-foreground border-border";
                            return (
                              <li key={p.id}>
                                <Link to={p.task ? `/tasks/${p.task.id}` : "#"} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", incoming ? "bg-primary/10 text-primary" : "bg-muted text-foreground/70")}>
                                    {incoming ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                      {p.task?.title || "Task"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {incoming ? "Received" : "Paid"} · Fee ${Number(p.platform_fee || 0).toFixed(2)} · {format(new Date(p.created_at), "MMM d, yyyy")}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className={cn("text-sm font-semibold tabular-nums", incoming ? "text-primary" : "")}>
                                      {incoming ? "+" : "−"}${net.toFixed(2)}
                                    </p>
                                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border capitalize inline-block mt-0.5", statusCls)}>
                                      {p.status}
                                    </span>
                                  </div>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* TRUST SUMMARY */}
            <Card className="shadow-card border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-semibold">Trust summary</h2>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold">{profileStrength.score}</span>
                  <span className="text-sm text-muted-foreground">/ 100 strength</span>
                </div>
                <Progress value={profileStrength.score} className="h-2 mt-2" />
                <ul className="mt-4 space-y-2">
                  {trustReasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ThumbsUp className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <span className="text-foreground/85">{reason}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* TRUST PASSPORT */}
            <TrustPassportCard profile={profile as any} isOwner={isOwner} emailVerified={emailVerified} />

            {/* OWNER CHECKLIST */}
            {isOwner && profileStrength.score < 100 && (
              <Card className="shadow-card border-accent/30 bg-accent/5">
                <CardContent className="p-6">
                  <h2 className="font-display text-lg font-semibold mb-1 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" /> Boost your profile
                  </h2>
                  <p className="text-xs text-muted-foreground mb-3">Complete these to win more tasks.</p>
                  <ul className="space-y-2">
                    {profileStrength.items.filter((i) => !i.done).slice(0, 5).map((i) => (
                      <li key={i.label} className="flex items-center gap-2 text-sm text-foreground/85">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                        {i.label}
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" className="mt-4 w-full gap-1.5" onClick={() => setEditOpen(true)}>
                    <Edit className="h-3.5 w-3.5" /> Improve profile
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </motion.div>

      {isOwner && profile && (
        <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} profile={profile as any} />
      )}
    </div>
  );
}
