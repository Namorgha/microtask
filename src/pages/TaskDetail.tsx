import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/shared/StarRating";
import { ReportDialog } from "@/components/shared/ReportDialog";
import { TaskChat } from "@/components/chat/TaskChat";
import { MapPin, Clock, DollarSign, ArrowLeft, CheckCircle2, Circle, Loader2, Play, CreditCard, XCircle, Send, UserCheck, UserX, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { calculateDealConfidence } from "@/lib/dealConfidence";
import { ConfidenceCard } from "@/components/shared/ConfidenceCard";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { calculateDealQuality, calculateRequestQuality, calculateUserQuality } from "@/lib/qualityEngine";
import { QualityHints } from "@/components/quality/QualityHints";
import { LeaveReviewDialog } from "@/components/reviews/LeaveReviewDialog";
import { VerifiedBadges } from "@/components/verification/VerifiedBadge";

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

  return (
    <div className="container max-w-3xl py-6">
      <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {task.images && task.images.length > 0 && (
          <div className="rounded-xl overflow-hidden mb-6 h-64 md:h-80">
            <img src={task.images[0]} alt={task.title} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="capitalize">{task.category}</Badge>
                <Badge className="capitalize">{task.status.replace("_", " ")}</Badge>
                {task.flagged && <Badge variant="destructive">Flagged</Badge>}
              </div>
              <h1 className="font-display text-2xl font-bold md:text-3xl">{task.title}</h1>
              <p className="text-muted-foreground mt-1 text-sm">{format(new Date(task.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
            </div>

            <p className="text-foreground leading-relaxed">{task.description}</p>

            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-4 w-4" /> {task.location}</span>
              <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" /> {task.duration} min</span>
              <span className="flex items-center gap-1.5 font-semibold text-primary"><DollarSign className="h-4 w-4" /> ${Number(task.price)}</span>
            </div>

            {/* Deal confidence */}
            <ConfidenceCard result={taskConfidence} showSuggestions={isPoster} />

            {/* Platform Quality Engine — deal health */}
            {dealQuality && (isPoster || isDoer) && (
              <QualityHints result={dealQuality} title="Deal health" />
            )}

            {/* Task Progress */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-display font-semibold mb-3">Task Progress</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:flex sm:items-center sm:gap-2 sm:overflow-x-auto">
                  {statusSteps.map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      {i <= currentStep ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />}
                      <span className={`text-sm whitespace-nowrap ${i <= currentStep ? "font-medium" : "text-muted-foreground/50"}`}>{statusLabels[step]}</span>
                      {i < statusSteps.length - 1 && <div className={`hidden sm:block h-px w-6 ${i < currentStep ? "bg-primary" : "bg-muted"}`} />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payment status */}
            {payment && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">
                      Escrow: <span className="capitalize">{payment.status}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Amount: ${Number(payment.amount)} (Fee: ${Number(payment.platform_fee)})</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* How this works — trust messaging */}
            {(isPoster || isDoer || (!user || task.status === "open")) && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-sm">How this stays safe</p>
                      <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
                        <li>• Payment is funded into secure escrow before any work begins.</li>
                        <li>• Both sides can chat first to confirm details before starting.</li>
                        <li>• Funds are released only after the poster confirms completion.</li>
                        <li>• Reviews from both sides build long-term reputation.</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Applications (poster view) */}
            {isPoster && task.status === "open" && pendingApplications.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-display font-semibold">Requests ({pendingApplications.length})</h3>
                  {pendingApplications.map((app: any) => (
                    <div key={app.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {app.doer?.full_name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{app.doer?.full_name || "Anonymous"}</p>
                            <ConfidenceBadge
                              result={calculateDealConfidence({
                                task,
                                poster: app.doer
                                  ? {
                                      full_name: app.doer.full_name,
                                      avatar_url: app.doer.avatar_url,
                                      reputation_score: app.doer.reputation_score,
                                    }
                                  : null,
                              })}
                              size="sm"
                            />
                          </div>
                          {app.message && <p className="text-xs text-muted-foreground">{app.message}</p>}
                          <StarRating rating={Math.round(Number(app.doer?.reputation_score || 0))} size="sm" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApplicationAction.mutate({ applicationId: app.id, action: "accept" })}
                          disabled={handleApplicationAction.isPending}
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplicationAction.mutate({ applicationId: app.id, action: "reject" })}
                          disabled={handleApplicationAction.isPending}
                        >
                          <UserX className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Chat (visible to poster and doer after acceptance) */}
            {task.doer_id && (isPoster || isDoer) && task.status !== "open" && task.status !== "cancelled" && (
              <TaskChat taskId={task.id} posterId={task.poster_id} doerId={task.doer_id} />
            )}

            {/* Report button */}
            {user && !isPoster && (
              <div className="flex gap-2">
                <ReportDialog targetType="task" targetId={task.id} />
                {task.poster_id && <ReportDialog targetType="user" targetId={task.poster_id} triggerLabel="Report User" />}
              </div>
            )}
          </div>

          <div className="w-full lg:w-72 space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-display font-semibold mb-3">Posted by</h3>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-medium">
                    {(task.poster as any)?.full_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <p className="font-medium">{(task.poster as any)?.full_name || "Anonymous"}</p>
                    <StarRating rating={Math.round(Number((task.poster as any)?.reputation_score || 0))} size="sm" />
                    <VerifiedBadges identityVerified={(task.poster as any)?.identity_verified} addressVerified={(task.poster as any)?.address_verified} className="mt-1" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{(task.poster as any)?.completed_tasks_count || 0} tasks completed</p>
              </CardContent>
            </Card>

            {task.doer_id && (task.doer as any) && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-display font-semibold mb-3">Accepted by</h3>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-medium">
                      {(task.doer as any)?.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="font-medium">{(task.doer as any)?.full_name || "Anonymous"}</p>
                      <StarRating rating={Math.round(Number((task.doer as any)?.reputation_score || 0))} size="sm" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4 text-center space-y-3">
                <span className="font-display text-3xl font-bold text-primary">${Number(task.price)}</span>
                <p className="text-xs text-muted-foreground">Platform fee: ${(Number(task.price) * 0.08).toFixed(2)} (8%)</p>

                {/* Request button (non-poster, open task) */}
                {task.status === "open" && !isPoster && user && !myApplication && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add a message (optional)..."
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      className="text-sm min-h-[60px]"
                    />
                    {requestQuality && (
                      <QualityHints result={requestQuality} title="Request tips" compact showScore={false} />
                    )}
                    <Button className="w-full gap-2" size="lg" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending}>
                      {requestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Request Task
                    </Button>
                  </div>
                )}
                {task.status === "open" && !isPoster && myApplication && (
                  <p className="text-xs text-muted-foreground font-medium">
                    ✓ Request {myApplication.status === "pending" ? "sent" : myApplication.status}
                  </p>
                )}
                {task.status === "open" && !user && (
                  <Link to="/auth"><Button className="w-full" size="lg">Sign in to Request</Button></Link>
                )}

                {/* Poster: Fund Task (after acceptance) */}
                {isPoster && task.status === "accepted" && (
                  <Button className="w-full gap-2" size="lg" onClick={() => fundMutation.mutate()} disabled={fundMutation.isPending}>
                    {fundMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Fund Task (${Number(task.price)})
                  </Button>
                )}

                {/* Doer: Start Work (after funding) */}
                {isDoer && task.status === "funded" && (
                  <Button className="w-full gap-2" onClick={() => updateStatus.mutate("in_progress")} disabled={updateStatus.isPending}>
                    <Play className="h-4 w-4" /> Start Work
                  </Button>
                )}

                {/* Doer: Mark Completed */}
                {isDoer && task.status === "in_progress" && (
                  <Button className="w-full gap-2" onClick={() => updateStatus.mutate("completed")} disabled={updateStatus.isPending}>
                    <CheckCircle2 className="h-4 w-4" /> Mark Completed
                  </Button>
                )}

                {/* Poster: Release Payment (after completion) */}
                {isPoster && task.status === "completed" && (
                  <Button className="w-full gap-2" size="lg" onClick={() => releaseMutation.mutate()} disabled={releaseMutation.isPending}>
                    {releaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Release Payment
                  </Button>
                )}

                {/* Poster: Cancel open task */}
                {isPoster && task.status === "open" && (
                  <Button variant="outline" className="w-full gap-2" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                    <XCircle className="h-4 w-4" /> Cancel Task
                  </Button>
                )}

                {isPoster && task.status === "open" && (
                  <p className="text-xs text-muted-foreground">Waiting for requests...</p>
                )}
                {task.status === "funded" && isPoster && (
                  <p className="text-xs text-muted-foreground">💰 Funds held in escrow</p>
                )}
                {task.status === "paid" && (
                  <p className="text-xs text-muted-foreground font-medium text-primary">✓ Payment released</p>
                )}
                {task.status === "cancelled" && (
                  <p className="text-xs text-destructive font-medium">This task has been cancelled</p>
                )}
                {(task.status === "open" || task.status === "accepted") && (
                  <p className="text-xs text-muted-foreground">Payment held securely in escrow until completion</p>
                )}

                {/* Leave a review (poster or doer, after paid/completed) */}
                {user && (isPoster || isDoer) && task.doer_id &&
                  (task.status === "paid" || task.status === "completed") &&
                  !myReview && (
                    <LeaveReviewDialog
                      taskId={task.id}
                      taskTitle={task.title}
                      reviewerId={user.id}
                      revieweeId={isPoster ? task.doer_id : task.poster_id}
                      revieweeName={
                        isPoster
                          ? ((task.doer as any)?.full_name || "the doer")
                          : ((task.poster as any)?.full_name || "the poster")
                      }
                    />
                  )}
                {user && (isPoster || isDoer) && myReview &&
                  (task.status === "paid" || task.status === "completed") && (
                    <p className="text-xs text-muted-foreground font-medium">✓ You've left a review</p>
                  )}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
