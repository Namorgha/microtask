import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, DollarSign, Shield, Star, Zap, Clock, Sparkles, Search, Plus, UserPlus, FileText, MessageCircle, CheckCircle2, CreditCard, Wallet, ShieldCheck, Users as UsersIcon, TrendingUp, Eye, BadgeCheck, Lock, Home as HomeIcon, UserCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TaskCard } from "@/components/shared/TaskCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceCard } from "@/components/shared/ConfidenceCard";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import type { ConfidenceResult } from "@/lib/dealConfidence";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";

const features = [
  { icon: MapPin, title: "Find Tasks Nearby", desc: "Browse micro-tasks on an interactive map. Accept jobs in your neighborhood." },
  { icon: Clock, title: "Quick & Flexible", desc: "Tasks take 10–60 minutes. Earn money on your own schedule." },
  { icon: DollarSign, title: "Instant Payments", desc: "Secure escrow payments. Get paid the moment the task is done." },
  { icon: Shield, title: "Trust & Safety", desc: "Ratings, reviews, and verified profiles keep the community safe." },
  { icon: Star, title: "Build Reputation", desc: "Complete tasks, earn ratings, and unlock more opportunities." },
  { icon: Zap, title: "Real-Time Updates", desc: "Get notified instantly when tasks are posted, accepted, or completed." },
];

const steps = [
  { num: "01", title: "Post or Browse", desc: "Need help? Post a task. Want to earn? Browse nearby micro-tasks on the map." },
  { num: "02", title: "Accept & Do", desc: "Accept a task instantly. Show up, complete it, and mark it done." },
  { num: "03", title: "Get Paid", desc: "Payment is released automatically. Rate each other and build your reputation." },
];

const journeySteps = [
  {
    num: "01",
    icon: UserPlus,
    title: "Create your account",
    desc: "Sign up with email or Google in under a minute. Verify your email, complete your profile with a photo and short bio — this builds trust with the community.",
    forWho: "Everyone",
  },
  {
    num: "02",
    icon: Search,
    title: "Explore tasks near you",
    desc: "Browse the interactive map or feed to discover tasks posted in your area. Filter by category, price, or duration to find the perfect match.",
    forWho: "Doers",
  },
  {
    num: "03",
    icon: FileText,
    title: "Or post your own task",
    desc: "Describe what you need, set a fair price, pick a location and add photos if needed. Your task goes live instantly to nearby helpers.",
    forWho: "Posters",
  },
  {
    num: "04",
    icon: MessageCircle,
    title: "Request & accept",
    desc: "Doers send a request to take a task. Posters review the applicant's profile and rating, then accept or decline. Only one helper is assigned per task.",
    forWho: "Both",
  },
  {
    num: "05",
    icon: CreditCard,
    title: "Secure escrow payment",
    desc: "Once accepted, the poster funds the task securely via Stripe. Money is held safely in escrow — the doer knows they'll get paid the moment the job is done.",
    forWho: "Posters",
  },
  {
    num: "06",
    icon: CheckCircle2,
    title: "Get the job done",
    desc: "Chat in real time inside the task page to coordinate. Once complete, the poster releases the payment and both sides leave a rating to grow their reputation.",
    forWho: "Both",
  },
];

// Demo confidence results for the home-page showcase
const demoHigh: ConfidenceResult = {
  score: 92,
  level: "high",
  summary: "Clear task details and trusted poster.",
  factors: [
    { key: "title", label: "Clear, specific title", delta: 8, positive: true },
    { key: "description", label: "Detailed description", delta: 12, positive: true },
    { key: "rating", label: "Highly rated (4.9★)", delta: 10, positive: true },
    { key: "history", label: "24 tasks completed", delta: 12, positive: true },
  ],
  suggestions: [],
};
const demoMedium: ConfidenceResult = {
  score: 64,
  level: "medium",
  summary: "Looks valid, but a few signals could be stronger.",
  factors: [
    { key: "history", label: "New user with limited history", delta: 0, positive: false },
    { key: "description", label: "Description is okay", delta: 6, positive: true },
    { key: "location", label: "Verified location", delta: 6, positive: true },
  ],
  suggestions: [],
};
const demoLow: ConfidenceResult = {
  score: 34,
  level: "low",
  summary: "Low trust signals — review carefully before proceeding.",
  factors: [
    { key: "title", label: "Title is short or vague", delta: -4, positive: false },
    { key: "description", label: "Description is too short", delta: -6, positive: false },
    { key: "price", label: "Price seems unusually low", delta: -4, positive: false },
  ],
  suggestions: [],
};

export default function Index() {
  const { data: nearbyTasks = [], isLoading } = useQuery({
    queryKey: ["home-nearby-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, poster:profiles!tasks_poster_id_profiles_fkey(full_name, reputation_score, avatar_url, identity_verified, address_verified)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="flex flex-col">
      {/* Onboarding (only renders when signed in & incomplete) */}
      <OnboardingChecklist />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.12),transparent_60%)]" />
        <div className="container relative flex flex-col items-center py-20 text-center md:py-28 lg:py-36">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent-foreground/90 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-foreground/80">The local micro-task marketplace</span>
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl mx-auto leading-[1.05]">
              Get anything done
              <br />
              <span className="text-primary">nearby, safely and fast.</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground md:text-xl leading-relaxed px-2">
              Post small local tasks, hire trusted people nearby, pay securely, and track everything from request to completion.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/post-task">
                <Button size="lg" className="gap-2 text-base px-8 h-12 bg-gradient-gold text-accent-foreground hover:opacity-90 shadow-gold border-0">
                  <Plus className="h-5 w-5" />
                  Post a Task
                </Button>
              </Link>
              <Link to="/tasks">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 h-12 border-2">
                  <Search className="h-5 w-5" />
                  Find Tasks
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats banner */}
      <section className="border-y bg-card/50 backdrop-blur-sm py-10">
        <div className="container">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { value: "2,500+", label: "Tasks Completed", gold: false },
              { value: "1,200+", label: "Active Users", gold: false },
              { value: "$85K+", label: "Earned by Doers", gold: true },
              { value: "4.8★", label: "Avg. Rating", gold: true },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <p className={`font-display text-3xl font-bold tracking-tight md:text-4xl ${stat.gold ? "text-accent" : "text-primary"}`}>
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Nearby tasks preview */}
      <section className="py-20">
        <div className="container">
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-3xl font-bold">Latest tasks</h2>
              <p className="text-muted-foreground mt-2">Fresh opportunities waiting in your community.</p>
            </div>
            <Link to="/tasks">
              <Button variant="ghost" className="gap-1 text-primary hover:text-primary">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : nearbyTasks.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {nearbyTasks.map((task: any) => (
                <TaskCard
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  description={task.description}
                  price={Number(task.price)}
                  duration={task.duration}
                  category={task.category}
                  location={task.location}
                  posterName={task.poster?.full_name || "Anonymous"}
                  posterRating={Number(task.poster?.reputation_score || 0)}
                  posterIdentityVerified={!!task.poster?.identity_verified}
                  posterAddressVerified={!!task.poster?.address_verified}
                  status={task.status}
                  imageUrl={task.images?.[0]}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 py-16 text-center">
              <MapPin className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-display text-lg font-semibold">No tasks yet</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to post one.</p>
              <Link to="/post-task">
                <Button className="mt-5 gap-2"><Plus className="h-4 w-4" /> Post a Task</Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container">
          <h2 className="font-display text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="text-center"
              >
                <span className="font-display text-5xl font-bold text-accent/30">{step.num}</span>
                <h3 className="font-display text-xl font-semibold mt-2">{step.title}</h3>
                <p className="text-muted-foreground mt-2">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Full user journey */}
      <section className="border-t py-20 bg-background">
        <div className="container max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium mb-5">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-foreground/80">Your full journey</span>
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              From sign-up to your <span className="text-primary">first paid task</span>
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              A clear, step-by-step guide to using MicroTask — whether you want to earn money helping neighbors or get your own tasks done.
            </p>
          </div>

          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-6 md:left-1/2 top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-accent/40 to-primary/40 md:-translate-x-1/2 hidden sm:block" />

            <div className="space-y-8 md:space-y-12">
              {journeySteps.map((step, i) => {
                const isLeft = i % 2 === 0;
                return (
                  <motion.div
                    key={step.num}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: 0.05 }}
                    className={`relative grid sm:grid-cols-[3rem_1fr] md:grid-cols-2 gap-4 md:gap-12 items-center`}
                  >
                    {/* Number circle (mobile + desktop center) */}
                    <div className={`hidden md:flex ${isLeft ? "md:order-2 md:justify-start" : "md:order-1 md:justify-end"}`}>
                      <div className={`w-full max-w-md ${isLeft ? "" : "text-right"}`}>
                        <div className={`inline-flex items-center gap-2 mb-3 ${isLeft ? "" : "flex-row-reverse"}`}>
                          <span className="text-xs font-semibold uppercase tracking-wider text-accent">For {step.forWho}</span>
                        </div>
                        <h3 className="font-display text-xl md:text-2xl font-bold mb-2">{step.title}</h3>
                        <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                      </div>
                    </div>

                    {/* Icon node */}
                    <div className={`flex sm:justify-center ${isLeft ? "md:order-1" : "md:order-2"} relative z-10`}>
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                        <div className="relative flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-full border-2 border-primary/30 bg-card shadow-elevated">
                          <step.icon className="h-5 w-5 md:h-7 md:w-7 text-primary" />
                          <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-gold text-[10px] font-bold text-accent-foreground shadow-gold">
                            {step.num}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile content */}
                    <div className="md:hidden col-start-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-accent">For {step.forWho}</span>
                      <h3 className="font-display text-lg font-bold mt-1 mb-1.5">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Two-path CTA */}
          <div className="grid gap-5 sm:grid-cols-2 mt-16 max-w-3xl mx-auto">
            <Link to="/post-task" className="group">
              <div className="h-full rounded-2xl border-2 border-border bg-card p-6 transition-all hover:border-accent hover:shadow-gold hover:-translate-y-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-gold shadow-gold mb-4">
                  <Plus className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-display text-lg font-bold">I need help with a task</h3>
                <p className="text-sm text-muted-foreground mt-1.5">Post your first task in 2 minutes and find a trusted helper nearby.</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent mt-4 group-hover:gap-2 transition-all">
                  Post a task <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
            <Link to="/tasks" className="group">
              <div className="h-full rounded-2xl border-2 border-border bg-card p-6 transition-all hover:border-primary hover:shadow-elevated hover:-translate-y-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-elevated mb-4">
                  <Wallet className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-bold">I want to earn money</h3>
                <p className="text-sm text-muted-foreground mt-1.5">Browse open tasks around you and start earning on your own schedule.</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-4 group-hover:gap-2 transition-all">
                  Find tasks <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container">
          <h2 className="font-display text-3xl font-bold text-center mb-12">Why MicroTask?</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-2xl border bg-card p-6 transition-all hover:shadow-elevated hover:-translate-y-1"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold mt-4">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Deal Confidence Score showcase */}
      <section className="py-20 border-t bg-gradient-hero">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                <Sparkles className="h-3.5 w-3.5" /> New
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-4 leading-tight">
                Know who to trust — <span className="text-gold">at a glance</span>
              </h2>
              <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                Every task and every requester gets a <strong className="text-foreground">Deal Confidence Score</strong> —
                a smart trust signal built from task quality, poster reputation, profile completeness,
                payment status, and more. No guessing, no bad surprises.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <ConfidenceBadge result={demoHigh} size="md" showScore withPopover={false} />
                <ConfidenceBadge result={demoMedium} size="md" showScore withPopover={false} />
                <ConfidenceBadge result={demoLow} size="md" showScore withPopover={false} />
              </div>

              <ul className="mt-6 space-y-3">
                {[
                  "Clear trust signals on every task card",
                  "Detailed breakdown before you request or accept",
                  "Smart tips to help you build a more trusted profile",
                  "Always transparent — never blocks, just guides",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                    <span className="text-foreground/85">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-3"
            >
              <ConfidenceCard result={demoHigh} compact showSuggestions={false} />
              <ConfidenceCard result={demoMedium} compact showSuggestions={false} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Platform Quality Engine — public showcase */}
      <section className="py-20 border-t bg-background">
        <div className="container max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium mb-5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground/80">Platform Quality Engine</span>
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              A smarter marketplace, <span className="text-primary">protected by quality rules</span>
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Every task, profile, request and deal runs through built-in quality checks — keeping posts clear, users accountable, and deals safer from the start.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: FileText,
                title: "Clearer Tasks",
                desc: "We guide posters to write clear titles, useful descriptions, fair prices, and accurate locations — before the task goes live.",
                tone: "primary" as const,
              },
              {
                icon: UsersIcon,
                title: "Safer Users",
                desc: "Profile completion, ratings, history and reports feed into trust signals that keep unreliable behavior under control.",
                tone: "gold" as const,
              },
              {
                icon: TrendingUp,
                title: "Smarter Ranking",
                desc: "High-quality tasks and reliable users get better visibility, helping serious people connect faster — no spam in the way.",
                tone: "primary" as const,
              },
              {
                icon: Eye,
                title: "Admin Oversight",
                desc: "Real-time quality signals help admins spot risky tasks, weak profiles, and stalled deals — and act on them fast.",
                tone: "gold" as const,
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className="group relative rounded-2xl border-2 border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl mb-4 ${
                    card.tone === "gold"
                      ? "bg-gradient-gold shadow-gold text-accent-foreground"
                      : "bg-gradient-primary shadow-elevated text-primary-foreground"
                  }`}
                >
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-bold">{card.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Explainable scores, no black box</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Guides users instead of blocking them</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Always on, every step of the deal</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      {/* Trust Passport */}
      <section className="py-20 border-t bg-muted/20">
        <div className="container max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium mb-5">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground/80">Trust Passport</span>
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              Trust Passport for <span className="text-primary">safer local tasks</span>
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Verify your identity and address to build trust faster, and work with people who take the platform seriously.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: UserCheck,
                title: "Verified People",
                desc: "Users can submit ID and address documents to prove they are real. Every request is reviewed by platform admins before a badge is issued.",
                tone: "primary" as const,
              },
              {
                icon: HomeIcon,
                title: "Safer Home Tasks",
                desc: "For tasks involving home access or valuable items, verified users stand out — making it easier to choose someone you can trust.",
                tone: "gold" as const,
              },
              {
                icon: ShieldCheck,
                title: "Clear Trust Signals",
                desc: "Verified Citizen and Address Confirmed badges appear on profiles, task cards and chat — so you always know who you are dealing with.",
                tone: "primary" as const,
              },
              {
                icon: Lock,
                title: "Private by Design",
                desc: "Your documents are stored privately and only reviewed by admins. Other users only ever see your verification badge — never the documents.",
                tone: "gold" as const,
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className="group relative rounded-2xl border-2 border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl mb-4 ${
                    card.tone === "gold"
                      ? "bg-gradient-gold shadow-gold text-accent-foreground"
                      : "bg-gradient-primary shadow-elevated text-primary-foreground"
                  }`}
                >
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-bold">{card.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Admin-reviewed verification</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Documents kept private</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Public badges, never private files</span>
          </div>
        </div>
      </section>

      <section className="border-t bg-gradient-primary py-16">
        <div className="container text-center">
          <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">Ready to get started?</h2>
          <p className="text-primary-foreground/85 mt-3 text-lg">Join MicroTask today and start earning or getting things done.</p>
          <Link to="/auth">
            <Button size="lg" className="mt-7 gap-2 text-base px-8 h-12 bg-gradient-gold text-accent-foreground hover:opacity-90 shadow-gold border-0">
              Create Free Account
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>


      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-primary">
              <span className="font-display text-sm font-bold text-primary-foreground">M</span>
            </div>
            <span className="font-display font-semibold text-foreground">MicroTask Exchange</span>
          </div>
          <p>© {new Date().getFullYear()} MicroTask Exchange. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
