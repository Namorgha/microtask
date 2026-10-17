import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, CheckCircle2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type PulseEvent = {
  id: string;
  icon: "new" | "done" | "spark";
  text: string;
};

const ICONS = {
  new: Activity,
  done: CheckCircle2,
  spark: Sparkles,
};

export function LiveActivityPulse() {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const push = (ev: Omit<PulseEvent, "id">) => {
    const id = crypto.randomUUID();
    const full = { ...ev, id };
    setEvents((prev) => [...prev.slice(-2), full]);
    const t = window.setTimeout(() => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      timers.current.delete(id);
    }, 5000);
    timers.current.set(id, t);
  };

  useEffect(() => {
    const channel = supabase
      .channel("live-activity-pulse")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks" },
        (payload) => {
          const t = payload.new as { title?: string; location?: string };
          const where = t.location ? ` near ${t.location.split(",")[0]}` : " nearby";
          push({ icon: "new", text: `Someone just posted a task${where}` });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: "status=eq.completed" },
        () => push({ icon: "done", text: "A task was just completed" })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: "status=eq.paid" },
        () => push({ icon: "spark", text: "A doer just got paid 🎉" })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 sm:left-6 sm:translate-x-0 sm:items-start">
      <AnimatePresence initial={false}>
        {events.map((ev) => {
          const Icon = ICONS[ev.icon];
          return (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.25 } }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="pointer-events-auto flex max-w-xs items-center gap-2.5 rounded-full border border-border/60 bg-background/85 px-4 py-2 shadow-elevated backdrop-blur-xl"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate text-xs font-medium text-foreground">{ev.text}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
