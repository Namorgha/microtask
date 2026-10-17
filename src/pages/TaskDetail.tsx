import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/shared/StarRating";
import { ReportDialog } from "@/components/shared/ReportDialog";
import { TaskChat } from "@/components/chat/TaskChat";
import { MapPin, Clock, ArrowLeft, CheckCircle2, Check, Loader2, Play, CreditCard, XCircle, Send, UserCheck, UserX, Shield, CalendarClock, ExternalLink, Lock, MessageCircle, BadgeCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { calculateDealConfidence } from "@/lib/dealConfidence";
import { ConfidenceCard } from "@/components/shared/ConfidenceCard";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { calculateDealQuality, calculateRequestQuality, calculateUserQuality } from "@/lib/qualityEngine";
import { QualityHints } from "@/components/quality/QualityHints";
import { LeaveReviewDialog } from "@/components/reviews/LeaveReviewDialog";
import { VerifiedBadges } from "@/components/verification/VerifiedBadge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { TaskLocationMap } from "@/components/map/TaskLocationMap";
import { cn } from "@/lib/utils";

const statusSteps = ["open", "accepted", "funded", "in_progress", "completed", "paid"];
const statusLabels: Record<string, string> = {
  open: "Open",
  accepted: "Accepted",
  funded: "Funded",
  in_progress: "In Progress",
  completed: "Completed",
  paid: "Paid",
};

export default function TaskDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [requestMessage, setRequestMessage] = useState("");

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
       .select("*, poster:profiles!tasks_poster_id_profiles_fkey(full_name, reputation_score, avatar_url, completed_tasks_count, identity_verified, address_verified), doer:profiles!tasks_doer_id_profiles_fkey(full_name, reputation_score, avatar_url, identity_verified, address_verified)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Real-time subscription for task updates
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`task-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["task", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  // Fetch applications
  const { data: applications } = useQuery({
    queryKey: ["task-applications", id],
    queryFn: async () => {
      const { data: apps } = await supabase
        .from("task_applications")
        .select("*")
        .eq("task_id", id!);
      if (!apps) return [];
      // Fetch doer profiles
      const doerIds = [...new Set(apps.map((a: any) => a.doer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, reputation_score, avatar_url")
        .in("user_id", doerIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      return apps.map((a: any) => ({ ...a, doer: profileMap[a.doer_id] || null }));
    },
    enabled: !!id && !!user,
  });

  // Real-time subscription for applications
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`apps-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_applications", filter: `task_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["task-applications", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  // Fetch payment info
  const { data: payment } = useQuery({
    queryKey: ["task-payment", id],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("task_id", id!).order("created_at", { ascending: false }).limit(1);
      return data?.[0] || null;
    },
    enabled: !!id && !!user,
  });

  // Has the current user already reviewed this task?
  const { data: myReview } = useQuery({
    queryKey: ["task-review-mine", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id")
        .eq("task_id", id!)
        .eq("reviewer_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!user,
  });

  // Check if current user already applied
  const myApplication = applications?.find((a: any) => a.doer_id === user?.id);

  // Request task mutation
  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!user || !task) throw new Error("Not authenticated");
      if (!user.email_confirmed_at) throw new Error("Please verify your email first.");
      if (user.id === task.poster_id) throw new Error("You cannot request your own task.");
      if (task.status !== "open") throw new Error("This task is no longer accepting requests.");
      const { error } = await supabase.from("task_applications").insert({
        task_id: task.id,
        doer_id: user.id,
        message: requestMessage.trim() || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("You already requested this task.");
        if (error.code === "42501" || /row-level security/i.test(error.message)) {
          throw new Error("You don't have permission to request this task.");
        }
        throw error;
      }
      // Notify poster
      await supabase.from("notifications").insert({
        user_id: task.poster_id,
        title: "New Task Request",
        message: `Someone wants to do "${task.title}".`,
        type: "task_application",
        data: { task_id: task.id },
      });
    },
    onSuccess: () => {
      toast({ title: "Request sent!" });
      setRequestMessage("");
      queryClient.invalidateQueries({ queryKey: ["task-applications", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Accept/reject via edge function
  const handleApplicationAction = useMutation({
    mutationFn: async ({ applicationId, action }: { applicationId: string; action: "accept" | "reject" }) => {
      const { data, error } = await supabase.functions.invoke("accept-task-request", {
        body: { application_id: applicationId, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Updated!" });
      queryClient.invalidateQueries({ queryKey: ["task", id] });
      queryClient.invalidateQueries({ queryKey: ["task-applications", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { data, error } = await supabase.functions.invoke("update-task-status", {
        body: { task_id: task!.id, new_status: newStatus },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", id] });
      toast({ title: "Status updated!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").update({ status: "cancelled" as any }).eq("id", task!.id).eq("poster_id", user!.id);
      if (error) throw error;
      if (task!.doer_id) {
        await supabase.from("notifications").insert({
          user_id: task!.doer_id,
          title: "Task Cancelled",
          message: `"${task!.title}" has been cancelled by the poster.`,
          type: "task_cancelled",
          data: { task_id: task!.id },
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Task cancelled" });
      queryClient.invalidateQueries({ queryKey: ["task", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fundMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-task-payment", {
        body: { task_id: task!.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("No checkout URL returned");
      return data.url as string;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: (e: any) => toast({ title: "Payment Error", description: e.message, variant: "destructive" }),
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("release-task-payment", {
        body: { task_id: task!.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Payment released!" });
      queryClient.invalidateQueries({ queryKey: ["task", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!task) {
    return <div className="container py-16 text-center text-muted-foreground">Task not found</div>;
  }

  const currentStep = statusSteps.indexOf(task.status);
  const isPoster = user?.id === task.poster_id;
  const isDoer = user?.id === task.doer_id;
  const pendingApplications = applications?.filter((a: any) => a.status === "pending") || [];

  // Deal confidence for the task
  const taskConfidence = calculateDealConfidence({
    task,
    poster: (task.poster as any)
      ? {
          full_name: (task.poster as any).full_name,
          avatar_url: (task.poster as any).avatar_url,
          reputation_score: (task.poster as any).reputation_score,
          completed_tasks_count: (task.poster as any).completed_tasks_count,
        }
      : null,
    funded: payment?.status === "escrow" || task.status === "funded" || task.status === "in_progress",
  });

  // Platform Quality Engine — deal health (poster + doer view)
  const dealQuality = task.doer_id
    ? calculateDealQuality({
        task: { status: task.status, created_at: task.created_at, updated_at: task.updated_at },
        payment: payment ? { status: payment.status, updated_at: payment.updated_at } : null,
        poster: task.poster as any,
        doer: task.doer as any,
      })
    : null;

  // Request quality preview while user types
  const requestQuality =
    user && !isPoster && task.status === "open" && !myApplication
      ? calculateRequestQuality({
          message: requestMessage,
          duplicate: false,
          requester: null,
        })
      : null;

  const poster = task.poster as any;
  const doer = task.doer as any;
  const hasCoords = Number.isFinite(Number(task.lat)) && Number.isFinite(Number(task.lng));
  const price = Number(task.price);
  const fee = price * 0.08;
  const isCancelled = task.status === "cancelled";

  const statusStyles: Record<string, string> = {
    open: "bg-success/10 text-success border-success/25",
    accepted: "bg-accent/10 text-accent border-accent/25",
    funded: "bg-primary/10 text-primary border-primary/25",
    in_progress: "bg-primary/10 text-primary border-primary/25",
    completed: "bg-muted text-muted-foreground border-border",
    paid: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-destructive/10 text-destructive border-destructive/25",
  };

  const Person = ({ p, label }: { p: any; label: string }) => {
    const rating = Number(p?.reputation_score || 0);
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">{label}</p>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center font-display font-semibold text-primary">
            {p?.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p?.full_name?.charAt(0)?.toUpperCase() || "?")}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{p?.full_name || "Anonymous"}</p>
            {rating > 0 ? (
              <div className="flex items-center gap-1.5">
                <StarRating rating={Math.round(rating)} size="sm" />
                <span className="text-xs text-muted-foreground">{rating.toFixed(1)}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">New on MicroTask</span>
            )}
          </div>
        </div>
        <VerifiedBadges identityVerified={p?.identity_verified} addressVerified={p?.address_verified} className="mt-3" />
      </div>
    );
  };

  return (
    <div className="container max-w-6xl py-6 md:py-10">
      <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <CategoryBadge category={task.category} />
            <Badge variant="outline" className={cn("capitalize border", statusStyles[task.status])}>{statusLabels[task.status] || task.status.replace("_", " ")}</Badge>
            {task.flagged && <Badge variant="destructive">Flagged</Badge>}
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">{task.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {task.location}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> About {task.duration} min</span>
            <span className="flex items-center gap-1.5" title={format(new Date(task.created_at), "MMM d, yyyy 'at' h:mm a")}>
              <CalendarClock className="h-4 w-4" /> Posted {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:gap-x-10">
          {/* Main — top */}
          <div className="space-y-6 min-w-0">
            {task.images && task.images.length > 0 && (
              <div className="rounded-2xl overflow-hidden h-64 md:h-80 border border-border/60">
                <img src={task.images[0]} alt={task.title} className="h-full w-full object-cover" />
              </div>
            )}

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">About this task</h2>
              <p className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-line">{task.description}</p>
            </section>

            {hasCoords && (
              <section className="overflow-hidden rounded-2xl border border-border/60">
                <TaskLocationMap lat={Number(task.lat)} lng={Number(task.lng)} />
                <div className="flex items-center justify-between gap-3 bg-card px-4 py-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{task.location}</span>
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${task.lat},${task.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Directions <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:row-span-2 lg:self-start lg:sticky lg:top-24">
            <Card className="overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Task price</p>
                    <p className="font-display text-4xl font-bold text-foreground">${price}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground leading-relaxed">
                    <p>Helper earns <span className="font-medium text-foreground">${(price - fee).toFixed(2)}</span></p>
                    <p>8% platform fee</p>
                  </div>
                </div>

                {/* Request (non-poster, open task) */}
                {task.status === "open" && !isPoster && user && !myApplication && (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Introduce yourself — why are you a good fit?"
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      className="text-sm min-h-[84px] resize-none"
                      maxLength={500}
                    />
                    {requestQuality && requestMessage.trim().length > 0 && (
                      <QualityHints result={requestQuality} title="Request tips" compact showScore={false} />
                    )}
                    <Button className="w-full gap-2" size="lg" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending}>
                      {requestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Request this task
                    </Button>
                  </div>
                )}
                {task.status === "open" && !isPoster && myApplication && (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    Request {myApplication.status === "pending" ? "sent — waiting for the poster" : myApplication.status}
                  </div>
                )}
                {task.status === "open" && !user && (
                  <Link to="/auth" className="block"><Button className="w-full" size="lg">Sign in to request</Button></Link>
                )}

                {isPoster && task.status === "accepted" && (
                  <Button className="w-full gap-2" size="lg" onClick={() => fundMutation.mutate()} disabled={fundMutation.isPending}>
                    {fundMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Fund task (${price})
                  </Button>
                )}
                {isDoer && task.status === "funded" && (
                  <Button className="w-full gap-2" size="lg" onClick={() => updateStatus.mutate("in_progress")} disabled={updateStatus.isPending}>
                    <Play className="h-4 w-4" /> Start work
                  </Button>
                )}
                {isDoer && task.status === "in_progress" && (
                  <Button className="w-full gap-2" size="lg" onClick={() => updateStatus.mutate("completed")} disabled={updateStatus.isPending}>
                    <CheckCircle2 className="h-4 w-4" /> Mark completed
                  </Button>
                )}
                {isPoster && task.status === "completed" && (
                  <Button className="w-full gap-2" size="lg" onClick={() => releaseMutation.mutate()} disabled={releaseMutation.isPending}>
                    {releaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Release payment
                  </Button>
                )}
                {isPoster && task.status === "open" && (
                  <>
                    <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
                      {pendingApplications.length > 0
                        ? `${pendingApplications.length} request${pendingApplications.length > 1 ? "s" : ""} waiting for you below`
                        : "Your task is live — waiting for requests."}
                    </p>
                    <Button variant="outline" className="w-full gap-2" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                      <XCircle className="h-4 w-4" /> Cancel task
                    </Button>
                  </>
                )}
                {task.status === "funded" && isPoster && (
                  <p className="text-sm text-muted-foreground">Funds are held in escrow until the work is done.</p>
                )}
                {task.status === "paid" && (
                  <p className="flex items-center gap-2 text-sm font-medium text-primary"><CheckCircle2 className="h-4 w-4" /> Payment released</p>
                )}
                {isCancelled && (
                  <p className="text-sm font-medium text-destructive">This task has been cancelled</p>
                )}

                {user && (isPoster || isDoer) && task.doer_id && (task.status === "paid" || task.status === "completed") && !myReview && (
                  <LeaveReviewDialog
                    taskId={task.id}
                    taskTitle={task.title}
                    reviewerId={user.id}
                    revieweeId={isPoster ? task.doer_id : task.poster_id}
                    revieweeName={isPoster ? (doer?.full_name || "the doer") : (poster?.full_name || "the poster")}
                  />
                )}
                {user && (isPoster || isDoer) && myReview && (task.status === "paid" || task.status === "completed") && (
                  <p className="text-sm text-muted-foreground">✓ You've left a review</p>
                )}

                {payment && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2.5 text-sm">
                    <Shield className="h-4 w-4 shrink-0 text-primary" />
                    <span>Escrow: <span className="font-medium capitalize">{payment.status}</span> · ${Number(payment.amount)}</span>
                  </div>
                )}

                {!isCancelled && task.status !== "paid" && (
                  <ul className="space-y-2 border-t border-border/60 pt-4 text-sm text-muted-foreground">
                    <li className="flex gap-2.5"><Lock className="h-4 w-4 shrink-0 text-primary mt-0.5" /> Paid into escrow before work starts</li>
                    <li className="flex gap-2.5"><MessageCircle className="h-4 w-4 shrink-0 text-primary mt-0.5" /> Chat to agree details first</li>
                    <li className="flex gap-2.5"><BadgeCheck className="h-4 w-4 shrink-0 text-primary mt-0.5" /> Released only when the poster confirms</li>
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-5">
                <Person p={poster} label="Posted by" />
                {poster?.completed_tasks_count > 0 && (
                  <p className="text-xs text-muted-foreground">{poster.completed_tasks_count} task{poster.completed_tasks_count > 1 ? "s" : ""} completed on MicroTask</p>
                )}
                {doer && task.doer_id && (
                  <div className="border-t border-border/60 pt-5">
                    <Person p={doer} label="Helper" />
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* Main — bottom */}
          <div className="space-y-6 min-w-0">
            {/* Progress */}
            <section className="rounded-2xl border border-border/60 bg-card p-5">
              <h2 className="font-display font-semibold mb-5">Progress</h2>
              {isCancelled ? (
                <p className="text-sm text-destructive">This task was cancelled.</p>
              ) : (
                <ol className="grid grid-cols-6">
                  {statusSteps.map((step, i) => {
                    const done = i < currentStep;
                    const current = i === currentStep;
                    return (
                      <li key={step} className="relative flex flex-col items-center text-center">
                        {i > 0 && (
                          <span className={cn("absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2", i <= currentStep ? "bg-primary" : "bg-border")} aria-hidden />
                        )}
                        <span
                          className={cn(
                            "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-card",
                            done && "border-primary bg-primary text-primary-foreground",
                            current && "border-primary ring-4 ring-primary/20",
                            !done && !current && "border-border",
                          )}
                        >
                          {done ? <Check className="h-3.5 w-3.5" /> : current ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                        </span>
                        <span className={cn("mt-2 px-0.5 text-[11px] leading-tight sm:text-xs", current ? "font-semibold text-foreground" : done ? "text-foreground/80" : "text-muted-foreground")}>
                          {statusLabels[step]}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {dealQuality && (isPoster || isDoer) && (
              <QualityHints result={dealQuality} title="Deal health" />
            )}

            {/* Requests (poster) */}
            {isPoster && task.status === "open" && pendingApplications.length > 0 && (
              <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                <h2 className="font-display font-semibold">Requests ({pendingApplications.length})</h2>
                {pendingApplications.map((app: any) => (
                  <div key={app.id} className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {app.doer?.full_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-sm">{app.doer?.full_name || "Anonymous"}</p>
                          <ConfidenceBadge
                            result={calculateDealConfidence({
                              task,
                              poster: app.doer ? { full_name: app.doer.full_name, avatar_url: app.doer.avatar_url, reputation_score: app.doer.reputation_score } : null,
                            })}
                            size="sm"
                          />
                        </div>
                        {app.message && <p className="mt-1 text-sm text-muted-foreground">{app.message}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" onClick={() => handleApplicationAction.mutate({ applicationId: app.id, action: "accept" })} disabled={handleApplicationAction.isPending}>
                        <UserCheck className="h-3.5 w-3.5 mr-1" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleApplicationAction.mutate({ applicationId: app.id, action: "reject" })} disabled={handleApplicationAction.isPending}>
                        <UserX className="h-3.5 w-3.5 mr-1" /> Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {task.doer_id && (isPoster || isDoer) && task.status !== "open" && !isCancelled && (
              <TaskChat taskId={task.id} posterId={task.poster_id} doerId={task.doer_id} />
            )}

            {/* Trust score */}
            <ConfidenceCard result={taskConfidence} compact showSuggestions={isPoster} />

            {user && !isPoster && (
              <div className="flex flex-wrap items-center gap-1 text-muted-foreground [&_button]:text-xs [&_button]:h-8">
                <ReportDialog targetType="task" targetId={task.id} />
                {task.poster_id && <ReportDialog targetType="user" targetId={task.poster_id} triggerLabel="Report user" />}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
