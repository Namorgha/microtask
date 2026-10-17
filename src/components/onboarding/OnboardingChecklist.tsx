import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, X, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { key: string; label: string; done: boolean; href: string; cta: string; optional?: boolean };

export function OnboardingChecklist() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (user) {
      setDismissed(localStorage.getItem(`mt_onboard_dismissed_${user.id}`) === "1");
    }
  }, [user]);

  const { data: profile } = useQuery({
    queryKey: ["onboard-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, headline, bio, identity_verified")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: postedCount = 0 } = useQuery({
    queryKey: ["onboard-posted", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("poster_id", user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

  if (!user || dismissed) return null;

  const steps: Step[] = [
    {
      key: "profile",
      label: "Complete your profile",
      done: !!(profile?.full_name && (profile?.bio || profile?.headline)),
      href: "/profile",
      cta: "Edit profile",
    },
    {
      key: "photo",
      label: "Add a profile photo",
      done: !!profile?.avatar_url,
      href: "/profile",
      cta: "Add photo",
    },
    {
      key: "verify",
      label: "Verify identity (Trust Passport)",
      done: !!profile?.identity_verified,
      href: "/profile",
      cta: "Verify now",
      optional: true,
    },
    {
      key: "browse",
      label: "Browse nearby tasks",
      done: false,
      href: "/tasks",
      cta: "Browse",
      optional: true,
    },
    {
      key: "post",
      label: "Post your first task",
      done: postedCount > 0,
      href: "/post-task",
      cta: "Post task",
      optional: true,
    },
  ];

  const requiredDone = steps.filter((s) => !s.optional && s.done).length;
  const requiredTotal = steps.filter((s) => !s.optional).length;
  const totalDone = steps.filter((s) => s.done).length;
  const pct = Math.round((totalDone / steps.length) * 100);

  // Hide entirely once everything is done
  if (totalDone === steps.length) return null;

  const dismiss = () => {
    localStorage.setItem(`mt_onboard_dismissed_${user.id}`, "1");
    setDismissed(true);
  };

  return (
    <section className="container py-6">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-accent/5 shadow-card">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-gold shadow-gold">
                <Sparkles className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-lg sm:text-xl font-bold">Welcome — let's get you ready</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Complete a few quick steps to build trust and start using the platform.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss" className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <Progress value={pct} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{totalDone}/{steps.length}</span>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li
                key={s.key}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border bg-card/60 p-3 transition-colors",
                  s.done ? "border-primary/30" : "border-border"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {s.done ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                  <span className={cn("text-sm truncate", s.done && "text-muted-foreground line-through")}>
                    {s.label}
                    {s.optional && !s.done && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">Optional</span>
                    )}
                  </span>
                </div>
                {!s.done && (
                  <Link to={s.href} className="shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-primary hover:text-primary">
                      {s.cta} <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {requiredDone < requiredTotal && (
            <p className="text-xs text-muted-foreground mt-3">
              You can skip optional steps — the platform still works normally.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}