import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskCard } from "@/components/shared/TaskCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Inbox, Loader2, CheckCircle2, Wallet, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ACTIVE_STATUSES = ["open", "accepted", "funded", "in_progress"];

function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  primary,
  secondary,
}: {
  icon?: any;
  title: string;
  description: string;
  primary?: { to: string; label: string; gold?: boolean };
  secondary?: { to: string; label: string };
}) {
  return (
    <div className="py-16 sm:py-20 px-6 text-center rounded-2xl border border-dashed border-border bg-card/40">
      <div className="h-14 w-14 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground/60" />
      </div>
      <p className="text-foreground font-display font-semibold text-lg">{title}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>
      {(primary || secondary) && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-5">
          {primary && (
            <Link to={primary.to}>
              <Button className={primary.gold ? "gap-2 bg-gradient-gold text-accent-foreground hover:opacity-90 shadow-gold border-0" : "gap-2"}>
                {primary.label}
              </Button>
            </Link>
          )}
          {secondary && (
            <Link to={secondary.to}>
              <Button variant="outline">{secondary.label}</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function renderGrid(tasks: any[], asYou = false) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task: any) => (
        <TaskCard
          key={task.id}
          id={task.id}
          title={task.title}
          description={task.description}
          price={Number(task.price)}
          duration={task.duration}
          category={task.category}
          location={task.location}
          posterName={asYou ? "You" : task.poster?.full_name || "Anonymous"}
          posterRating={Number(task.poster?.reputation_score || 0)}
          posterIdentityVerified={!asYou && !!task.poster?.identity_verified}
          posterAddressVerified={!asYou && !!task.poster?.address_verified}
          status={task.status}
          imageUrl={task.images?.[0]}
        />
      ))}
    </div>
  );
}

export default function MyTasks() {
  const { user } = useAuth();

  const { data: postedTasks = [], isLoading: loadingPosted } = useQuery({
    queryKey: ["my-posted-tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, poster:profiles!tasks_poster_id_profiles_fkey(full_name, reputation_score, identity_verified, address_verified)")
        .eq("poster_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: acceptedTasks = [], isLoading: loadingAccepted } = useQuery({
    queryKey: ["my-accepted-tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, poster:profiles!tasks_poster_id_profiles_fkey(full_name, reputation_score, identity_verified, address_verified)")
        .eq("doer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground mb-4">Sign in to see your tasks</p>
        <Link to="/auth"><Button>Sign In</Button></Link>
      </div>
    );
  }

  const allTasks = [...postedTasks, ...acceptedTasks];
  const active = allTasks.filter((t: any) => ACTIVE_STATUSES.includes(t.status));
  const completed = allTasks.filter((t: any) => t.status === "completed");
  const paid = allTasks.filter((t: any) => t.status === "paid");
  const cancelled = allTasks.filter((t: any) => t.status === "cancelled");

  const isLoading = loadingPosted || loadingAccepted;

  return (
    <div className="container max-w-7xl py-8">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold">My Tasks</h1>
            <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">Manage tasks you've posted or accepted.</p>
          </div>
          <Link to="/post-task" className="sm:shrink-0">
            <Button className="w-full sm:w-auto gap-2 bg-gradient-gold text-accent-foreground hover:opacity-90 shadow-gold border-0">
              <Plus className="h-4 w-4" /> Post Task
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="active">
          <TabsList className="bg-muted/60 p-1 h-auto sm:h-11 grid grid-cols-2 gap-1 w-full sm:flex sm:w-auto">
            <TabsTrigger value="active" className="gap-2 px-4">
              Active <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary">{active.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2 px-4">
              Completed <Badge variant="secondary" className="ml-1">{completed.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="paid" className="gap-2 px-4">
              Paid <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary">{paid.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="gap-2 px-4">
              Cancelled <Badge variant="secondary" className="ml-1">{cancelled.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : active.length > 0 ? renderGrid(active) : (
              <EmptyState
                title="No active tasks yet"
                description="Post a task to get help nearby, or browse open tasks to start earning."
                primary={{ to: "/post-task", label: "Post a Task", gold: true }}
                secondary={{ to: "/tasks", label: "Browse Tasks" }}
              />
            )}
          </TabsContent>
          <TabsContent value="completed" className="mt-6">
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : completed.length > 0 ? renderGrid(completed) : (
              <EmptyState
                icon={CheckCircle2}
                title="No completed tasks"
                description="Tasks marked completed by the doer appear here, waiting for payment to be released."
              />
            )}
          </TabsContent>
          <TabsContent value="paid" className="mt-6">
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : paid.length > 0 ? renderGrid(paid) : (
              <EmptyState
                icon={Wallet}
                title="No paid tasks yet"
                description="Once a task is fully completed and payment is released, it shows up here with full history."
              />
            )}
          </TabsContent>
          <TabsContent value="cancelled" className="mt-6">
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : cancelled.length > 0 ? renderGrid(cancelled) : (
              <EmptyState
                icon={XCircle}
                title="No cancelled tasks"
                description="Good — nothing has been cancelled. Cancelled tasks would appear here."
              />
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
