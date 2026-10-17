import { differenceInHours, differenceInDays } from "date-fns";

export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertType = "task" | "payment" | "verification" | "user" | "report";

export interface HealthAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  relatedId?: string;
  relatedUserId?: string;
  actionLabel: string;
  actionTarget: string; // admin tab key
  createdAt: string;
  recommended?: string;
}

interface Inputs {
  tasks: any[];
  payments: any[];
  verifications: any[];
  profiles: any[];
}

const SEV_ORDER: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function generatePlatformHealthAlerts({ tasks, payments, verifications, profiles }: Inputs): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const now = new Date();

  // Index payments by task
  const paymentsByTask = new Map<string, any[]>();
  for (const p of payments) {
    const arr = paymentsByTask.get(p.task_id) ?? [];
    arr.push(p);
    paymentsByTask.set(p.task_id, arr);
  }

  // ===== Task lifecycle alerts =====
  for (const t of tasks) {
    const updated = new Date(t.updated_at);
    const created = new Date(t.created_at);
    const hUpdated = differenceInHours(now, updated);
    const dCreated = differenceInDays(now, created);
    const taskPayments = paymentsByTask.get(t.id) ?? [];
    const hasEscrow = taskPayments.some((p) => p.status === "escrow" || p.status === "held");
    const hasReleased = taskPayments.some((p) => p.status === "completed" || p.status === "released");

    if (t.status === "accepted" && hUpdated >= 24 && !hasEscrow) {
      alerts.push(mk("task", hUpdated >= 72 ? "high" : "medium", "Accepted task not funded",
        `"${trunc(t.title)}" was accepted ${fmtAgo(hUpdated)} ago but no escrow funding has been received.`,
        t.id, t.poster_id, "View task", "tasks", t.updated_at, "Nudge poster to fund or cancel."));
    }
    if (t.status === "funded" && hUpdated >= 24) {
      alerts.push(mk("task", hUpdated >= 96 ? "high" : "medium", "Funded task not started",
        `"${trunc(t.title)}" has been funded for ${fmtAgo(hUpdated)} but the doer hasn't started.`,
        t.id, t.doer_id, "View task", "tasks", t.updated_at));
    }
    if (t.status === "in_progress" && hUpdated >= 72) {
      alerts.push(mk("task", hUpdated >= 168 ? "high" : "medium", "Task in progress too long",
        `"${trunc(t.title)}" has been in progress for ${fmtAgo(hUpdated)} without completion.`,
        t.id, t.doer_id, "View task", "tasks", t.updated_at));
    }
    if (t.status === "completed" && hUpdated >= 24 && hasEscrow && !hasReleased) {
      alerts.push(mk("task", hUpdated >= 72 ? "critical" : "high", "Payment not released",
        `"${trunc(t.title)}" was completed ${fmtAgo(hUpdated)} ago but escrow has not been released.`,
        t.id, t.poster_id, "Review payments", "payments", t.updated_at, "Contact poster or release manually."));
    }
    if (t.status === "open" && dCreated >= 14) {
      alerts.push(mk("task", "low", "Stale open task",
        `"${trunc(t.title)}" has been open with no doer for ${dCreated} days.`,
        t.id, t.poster_id, "View task", "tasks", t.created_at));
    }
    if (t.status === "cancelled" && hasEscrow && !hasReleased) {
      alerts.push(mk("payment", "critical", "Cancelled task with held escrow",
        `"${trunc(t.title)}" was cancelled but escrow funds appear to still be held.`,
        t.id, t.poster_id, "Check payments", "payments", t.updated_at, "Refund the payer."));
    }
    if (t.status === "paid" && !hasReleased && taskPayments.length > 0) {
      alerts.push(mk("payment", "high", "Paid task without released payment",
        `"${trunc(t.title)}" is marked paid but no payment is recorded as released.`,
        t.id, t.doer_id, "Check payments", "payments", t.updated_at));
    }
  }

  // ===== Payment alerts =====
  for (const p of payments) {
    const created = new Date(p.created_at);
    const hAge = differenceInHours(now, created);
    if (p.status === "pending" && hAge >= 24) {
      alerts.push(mk("payment", hAge >= 72 ? "high" : "medium", "Pending payment is old",
        `Payment of $${num(p.amount)} has been pending for ${fmtAgo(hAge)}.`,
        p.id, p.payer_id, "Open payments", "payments", p.created_at));
    }
    if (p.status === "failed") {
      alerts.push(mk("payment", "high", "Failed payment",
        `A payment of $${num(p.amount)} failed and may need attention.`,
        p.id, p.payer_id, "Open payments", "payments", p.created_at));
    }
    // Mismatch: payment escrow but task not in funded/in_progress/completed
    const t = tasks.find((x) => x.id === p.task_id);
    if (t && (p.status === "escrow" || p.status === "held") &&
        !["funded", "in_progress", "completed", "paid"].includes(t.status)) {
      alerts.push(mk("payment", "high", "Escrow / task status mismatch",
        `Escrow exists for "${trunc(t.title)}" but task status is "${t.status}".`,
        p.id, p.payer_id, "Investigate", "payments", p.updated_at ?? p.created_at));
    }
  }

  // ===== Verification alerts =====
  const pendingByUser = new Map<string, number>();
  for (const v of verifications) {
    const created = new Date(v.created_at);
    const hAge = differenceInHours(now, created);
    if (v.status === "pending") {
      pendingByUser.set(v.user_id, (pendingByUser.get(v.user_id) ?? 0) + 1);
      const missingDoc =
        (v.verification_type === "identity" && (!v.document_url || !v.selfie_url)) ||
        (v.verification_type === "address" && !v.address_document_url);
      if (missingDoc) {
        alerts.push(mk("verification", "medium", "Verification missing required file",
          `Pending ${v.verification_type} request is missing one or more required documents.`,
          v.id, v.user_id, "Review verification", "verifications", v.created_at));
      }
      if (hAge >= 24) {
        alerts.push(mk("verification", hAge >= 72 ? "high" : "medium",
          `${cap(v.verification_type)} verification waiting`,
          `A ${v.verification_type} verification has been pending review for ${fmtAgo(hAge)}.`,
          v.id, v.user_id, "Review verification", "verifications", v.created_at));
      }
    }
  }
  // Repeated rejected resubmissions
  const rejectedCounts = new Map<string, number>();
  for (const v of verifications) {
    if (v.status === "rejected") {
      const key = `${v.user_id}:${v.verification_type}`;
      rejectedCounts.set(key, (rejectedCounts.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of rejectedCounts) {
    if (count >= 2) {
      const [userId, type] = key.split(":");
      alerts.push(mk("verification", "medium", "Repeated rejected verifications",
        `User has ${count} rejected ${type} verification attempts.`,
        undefined, userId, "Review user", "verifications", new Date().toISOString()));
    }
  }
  // Profile flag set but no approved request
  for (const p of profiles) {
    if (p.identity_verified) {
      const ok = verifications.some((v) => v.user_id === p.user_id && v.verification_type === "identity" && v.status === "approved");
      if (!ok) {
        alerts.push(mk("verification", "high", "Verified flag without approved record",
          `Profile shows identity verified but no approved verification record exists.`,
          undefined, p.user_id, "Review user", "verifications", p.identity_verified_at ?? p.updated_at));
      }
    }
  }

  // ===== User trust alerts =====
  // Banned user with recent activity (post-ban tasks)
  for (const p of profiles) {
    if (p.banned_at) {
      const bannedAt = new Date(p.banned_at);
      const recent = tasks.find((t) => t.poster_id === p.user_id && new Date(t.created_at) > bannedAt);
      if (recent) {
        alerts.push(mk("user", "critical", "Banned user still active",
          `Banned user posted/updated activity after their ban timestamp.`,
          undefined, p.user_id, "Open users", "users", recent.created_at));
      }
    }
    // High cancellation rate
    const posted = tasks.filter((t) => t.poster_id === p.user_id);
    if (posted.length >= 5) {
      const cancelled = posted.filter((t) => t.status === "cancelled").length;
      if (cancelled / posted.length >= 0.5) {
        alerts.push(mk("user", "medium", "High cancellation rate",
          `User cancelled ${cancelled} of ${posted.length} posted tasks (${Math.round((cancelled / posted.length) * 100)}%).`,
          undefined, p.user_id, "Open user", "users", new Date().toISOString()));
      }
    }
    // Duplicate task posts (same title within 24h)
    if (posted.length >= 2) {
      const titles = new Map<string, any[]>();
      for (const t of posted) {
        const k = (t.title || "").trim().toLowerCase();
        if (!k) continue;
        const arr = titles.get(k) ?? [];
        arr.push(t);
        titles.set(k, arr);
      }
      for (const arr of titles.values()) {
        if (arr.length >= 2) {
          alerts.push(mk("user", "low", "Possible duplicate task posts",
            `User posted ${arr.length} tasks with the same title.`,
            arr[0].id, p.user_id, "Open user", "users", arr[0].created_at));
          break;
        }
      }
    }
  }

  // Sort: severity then newest
  alerts.sort((a, b) => {
    const s = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
    if (s !== 0) return s;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // De-duplicate by id
  const seen = new Set<string>();
  return alerts.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

function mk(type: AlertType, severity: AlertSeverity, title: string, description: string,
            relatedId: string | undefined, relatedUserId: string | undefined,
            actionLabel: string, actionTarget: string, createdAt: string, recommended?: string): HealthAlert {
  const id = `${type}:${title}:${relatedId ?? ""}:${relatedUserId ?? ""}`;
  return { id, type, severity, title, description, relatedId, relatedUserId, actionLabel, actionTarget, createdAt, recommended };
}

function trunc(s: string, n = 50) { return !s ? "" : s.length > n ? s.slice(0, n) + "…" : s; }
function num(n: any) { return Number(n ?? 0).toFixed(2); }
function cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function fmtAgo(hours: number) {
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  return `${d}d`;
}