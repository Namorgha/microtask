import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, MapPin, Star, DollarSign, UserCheck, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useEffect } from "react";

const typeIcons: Record<string, React.ElementType> = {
  task_nearby: MapPin,
  task_accepted: UserCheck,
  review: Star,
  payment: DollarSign,
  task_completed: CheckCheck,
};

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-page-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        queryClient.invalidateQueries({ queryKey: ["unread-notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!user) {
    return (
      <div className="container py-16 text-center">
        <p className="text-muted-foreground mb-4">Sign in to see your notifications</p>
        <Link to="/auth"><Button>Sign In</Button></Link>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold md:text-3xl">Notifications</h1>
            {unreadCount > 0 && <p className="text-sm text-muted-foreground mt-1">{unreadCount} unread</p>}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : notifications.length > 0 ? (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const Icon = typeIcons[notif.type] || Bell;
              const taskId = (notif.data as any)?.task_id;
              const content = (
                <Card className={`transition-colors ${!notif.read ? "border-primary/30 bg-primary/5" : ""} ${taskId ? "hover:border-primary/50 cursor-pointer" : ""}`}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${!notif.read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{notif.title}</h3>
                        {!notif.read && <Badge className="h-2 w-2 rounded-full p-0 bg-primary" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{notif.message}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}</p>
                    </div>
                  </CardContent>
                </Card>
              );
              return taskId ? (
                <Link key={notif.id} to={`/tasks/${taskId}`}>{content}</Link>
              ) : (
                <div key={notif.id}>{content}</div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 px-6 text-center rounded-2xl border border-dashed border-border bg-card/40">
            <div className="h-14 w-14 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-4">
              <Bell className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <p className="font-display font-semibold text-lg">No notifications yet</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
              You'll get real-time alerts here when someone requests your task, accepts your work, sends a message, or releases payment.
            </p>
            <div className="flex gap-2 justify-center mt-5">
              <Link to="/tasks"><Button variant="outline">Browse tasks</Button></Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
