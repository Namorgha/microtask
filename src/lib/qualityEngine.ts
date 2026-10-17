/**
 * Platform Quality Engine
 * ------------------------------------------------------------------
 * Deterministic, explainable, rule-based quality scoring for:
 *   - tasks
 *   - users
 *   - task requests
 *   - active deals (task + payment + activity)
 *
 * No AI. No remote calls. All inputs derived from existing platform data.
 * Every check returns { score, level, warnings, positives, recommendations }
 * so the UI can render concrete guidance, not vague stars.
 */

export type QualityLevel = "strong" | "good" | "new" | "needs_attention" | "restricted";

export type QualityResult = {
  score: number; // 0–100
  level: QualityLevel;
  warnings: string[];
  positives: string[];
  recommendations: string[];
};

const SPAM_WORDS = ["bitcoin", "crypto giveaway", "free money", "click here", "telegram me", "wire transfer", "sugar daddy", "onlyfans"];
const VAGUE_TITLES = ["help", "task", "need", "need help", "stuff", "thing", "something", "asap", "urgent", "quick task"];
const VISUAL_CATEGORIES = new Set(["repair", "cleaning", "moving", "delivery", "shopping"]);

/** Reasonable $/min ranges per category — used for price realism. */
const CATEGORY_RATES: Record<string, { min: number; max: number }> = {
  delivery: { min: 0.4, max: 2.5 },
  cleaning: { min: 0.3, max: 1.5 },
  repair: { min: 0.6, max: 3.5 },
  shopping: { min: 0.3, max: 1.8 },
  tech: { min: 0.6, max: 4 },
  tutoring: { min: 0.5, max: 2.5 },
  moving: { min: 0.5, max: 3 },
  other: { min: 0.2, max: 4 },
};

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function toLevel(score: number, opts?: { restricted?: boolean }): QualityLevel {
  if (opts?.restricted) return "restricted";
  if (score >= 85) return "strong";
  if (score >= 70) return "good";
  if (score >= 50) return "new";
  if (score >= 30) return "needs_attention";
  return "restricted";
}

export const LEVEL_LABEL: Record<QualityLevel, string> = {
  strong: "Strong",
  good: "Good",
  new: "New",
  needs_attention: "Needs attention",
  restricted: "Restricted",
};

export const LEVEL_TONE: Record<QualityLevel, "success" | "primary" | "muted" | "warning" | "destructive"> = {
  strong: "success",
  good: "primary",
  new: "muted",
  needs_attention: "warning",
  restricted: "destructive",
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. TASK QUALITY
// ─────────────────────────────────────────────────────────────────────────────

export type TaskQualityInput = {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  price?: number | null;
  duration?: number | null;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  images?: string[] | null;
  flagged?: boolean | null;
};

export function calculateTaskQuality(task: TaskQualityInput): QualityResult {
  const warnings: string[] = [];
  const positives: string[] = [];
  const recommendations: string[] = [];
  let score = 60;

  const title = (task.title || "").trim();
  const titleLower = title.toLowerCase();
  const titleWords = title.split(/\s+/).filter(Boolean);
  const isVague = VAGUE_TITLES.some((v) => titleLower === v || titleLower.startsWith(v + " "));

  if (title.length >= 12 && titleWords.length >= 3 && !isVague) {
    score += 10;
    positives.push("Clear, specific title");
  } else {
    score -= 8;
    warnings.push("Title is too short or vague");
    recommendations.push("Make your title more specific so doers understand the task at a glance.");
  }

  const desc = (task.description || "").trim();
  if (desc.length >= 150) {
    score += 14;
    positives.push("Detailed description");
  } else if (desc.length >= 60) {
    score += 6;
    recommendations.push("Add a couple more details to improve trust and visibility.");
  } else {
    score -= 12;
    warnings.push("Description is too short");
    recommendations.push("Write at least a few sentences explaining exactly what needs to be done.");
  }

  if (task.category && task.category !== "other") {
    score += 4;
    positives.push("Category selected");
  } else {
    recommendations.push("Pick a specific category to help the right people find your task.");
  }

  const hasCoords = typeof task.lat === "number" && typeof task.lng === "number" && (task.lat !== 0 || task.lng !== 0);
  const hasLocText = (task.location || "").trim().length > 2;
  if (hasCoords && hasLocText) {
    score += 8;
    positives.push("Verified location");
  } else {
    score -= 10;
    warnings.push("Location is missing or unverified");
    recommendations.push("Add a clear location so nearby doers can find this task.");
  }

  // Price realism
  const price = Number(task.price || 0);
  const duration = Number(task.duration || 0);
  const cat = (task.category || "other").toLowerCase();
  const rate = CATEGORY_RATES[cat] || CATEGORY_RATES.other;
  if (price > 0 && duration > 0) {
    const perMin = price / duration;
    if (perMin >= rate.min && perMin <= rate.max) {
      score += 8;
      positives.push("Price looks fair for the work");
    } else if (perMin < rate.min) {
      score -= 6;
      warnings.push("Price may be too low for this type of task");
      recommendations.push("Consider a more realistic price — low offers often go unfilled.");
    } else {
      score -= 4;
      warnings.push("Price seems unusually high");
    }
  }

  // Images for visual categories
  const hasImages = (task.images || []).length > 0;
  if (hasImages) {
    score += 4;
    positives.push("Photos included");
  } else if (VISUAL_CATEGORIES.has(cat)) {
    recommendations.push("Add a photo — visual context helps doers respond faster.");
  }

  // Spam / abuse
  const blob = `${titleLower} ${desc.toLowerCase()}`;
  const matchedSpam = SPAM_WORDS.find((w) => blob.includes(w));
  if (matchedSpam) {
    score -= 40;
    warnings.push(`Suspicious content detected ("${matchedSpam}")`);
  }
  if (task.flagged) {
    score -= 30;
    warnings.push("This task has been flagged");
  }

  score = clamp(score);
  return { score, level: toLevel(score), warnings, positives, recommendations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. USER QUALITY
// ─────────────────────────────────────────────────────────────────────────────

export type UserQualityInput = {
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  headline?: string | null;
  reputation_score?: number | null;
  total_reviews_count?: number | null;
  completed_tasks_count?: number | null;
  banned_at?: string | null;
  created_at?: string | null;
  email_verified?: boolean | null;
  /** Counts derived from related tables — pass 0 if unknown. */
  posted_tasks_count?: number;
  cancelled_tasks_count?: number;
  reports_against_count?: number;
};

export function calculateUserQuality(user: UserQualityInput): QualityResult {
  const warnings: string[] = [];
  const positives: string[] = [];
  const recommendations: string[] = [];

  if (user.banned_at) {
    return {
      score: 0,
      level: "restricted",
      warnings: ["Account is restricted"],
      positives: [],
      recommendations: [],
    };
  }

  let score = 55;

  // Profile completion
  const fields = [user.full_name, user.avatar_url, user.bio, user.location, user.headline].filter(
    (f) => typeof f === "string" && f.trim().length > 0
  ).length;
  if (fields >= 4) {
    score += 12;
    positives.push("Complete profile");
  } else if (fields >= 2) {
    score += 4;
    recommendations.push("Complete your profile to increase trust.");
  } else {
    score -= 10;
    warnings.push("Profile is mostly empty");
    recommendations.push("Add a photo, headline and short bio so others trust you.");
  }

  if (user.email_verified) {
    score += 8;
    positives.push("Verified email");
  } else {
    score -= 6;
    warnings.push("Email not verified");
    recommendations.push("Verify your email to unlock full access.");
  }

  const completed = Number(user.completed_tasks_count || 0);
  if (completed >= 10) {
    score += 14;
    positives.push(`${completed} tasks completed`);
  } else if (completed >= 3) {
    score += 8;
    positives.push(`${completed} tasks completed`);
  } else if (completed >= 1) {
    score += 3;
  } else {
    recommendations.push("Complete your first task to start building reputation.");
  }

  const reviews = Number(user.total_reviews_count || 0);
  const rating = Number(user.reputation_score || 0);
  if (reviews >= 3 && rating >= 4.5) {
    score += 12;
    positives.push(`Excellent rating (${rating.toFixed(1)}★)`);
  } else if (reviews >= 3 && rating >= 4) {
    score += 8;
    positives.push(`Strong rating (${rating.toFixed(1)}★)`);
  } else if (reviews >= 1 && rating < 3 && rating > 0) {
    score -= 12;
    warnings.push(`Low rating (${rating.toFixed(1)}★)`);
  }

  // Account age
  if (user.created_at) {
    const days = (Date.now() - new Date(user.created_at).getTime()) / 86400000;
    if (days >= 90) {
      score += 6;
      positives.push("Established account");
    } else if (days < 7) {
      recommendations.push("New account — build a few completed tasks to grow trust.");
    }
  }

  // Cancellation rate
  const posted = Number(user.posted_tasks_count || 0);
  const cancelled = Number(user.cancelled_tasks_count || 0);
  if (posted >= 4) {
    const rate = cancelled / posted;
    if (rate >= 0.4) {
      score -= 18;
      warnings.push(`High cancellation rate (${Math.round(rate * 100)}%)`);
    } else if (rate >= 0.2) {
      score -= 8;
      warnings.push(`Above-average cancellation rate (${Math.round(rate * 100)}%)`);
    }
  }

  // Reports
  const reports = Number(user.reports_against_count || 0);
  if (reports >= 3) {
    score -= 25;
    warnings.push(`${reports} reports filed against this account`);
  } else if (reports >= 1) {
    score -= 10;
    warnings.push("This account has been reported");
  }

  score = clamp(score);
  return { score, level: toLevel(score), warnings, positives, recommendations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. REQUEST QUALITY
// ─────────────────────────────────────────────────────────────────────────────

export type RequestQualityInput = {
  message?: string | null;
  /** How many requests this user has sent in the last hour. */
  recent_requests_count?: number;
  /** How many of this user's recent requests were rejected. */
  recent_rejected_count?: number;
  /** True if this is a duplicate request for the same task. */
  duplicate?: boolean;
  requester?: UserQualityInput | null;
};

export function calculateRequestQuality(req: RequestQualityInput): QualityResult {
  const warnings: string[] = [];
  const positives: string[] = [];
  const recommendations: string[] = [];
  let score = 65;

  if (req.duplicate) {
    return {
      score: 0,
      level: "restricted",
      warnings: ["You already requested this task"],
      positives: [],
      recommendations: [],
    };
  }

  const msg = (req.message || "").trim();
  if (msg.length >= 60) {
    score += 12;
    positives.push("Thoughtful request message");
  } else if (msg.length >= 15) {
    score += 4;
    recommendations.push("Add one more sentence on why you're a good fit.");
  } else {
    score -= 10;
    warnings.push("Request message is empty or very short");
    recommendations.push("Add a short message explaining why you're a good fit.");
  }

  const recent = Number(req.recent_requests_count || 0);
  if (recent >= 8) {
    score -= 20;
    warnings.push("Too many requests in a short time");
  } else if (recent >= 5) {
    score -= 8;
    warnings.push("Many recent requests — slow down a bit");
  }

  const rejected = Number(req.recent_rejected_count || 0);
  if (rejected >= 5) {
    score -= 15;
    warnings.push("Many recent requests have been rejected");
    recommendations.push("Improve your profile and write better request messages.");
  }

  if (req.requester) {
    const u = calculateUserQuality(req.requester);
    if (u.level === "restricted") {
      return { score: 0, level: "restricted", warnings: ["Requester account is restricted"], positives: [], recommendations: [] };
    }
    if (u.level === "needs_attention") {
      score -= 10;
      warnings.push("Requester profile needs attention");
    }
    if (u.level === "strong" || u.level === "good") {
      score += 6;
      positives.push("Trusted requester profile");
    }
  }

  score = clamp(score);
  return { score, level: toLevel(score), warnings, positives, recommendations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DEAL QUALITY (lifecycle health for an active task)
// ─────────────────────────────────────────────────────────────────────────────

export type DealQualityInput = {
  task: {
    status?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  payment?: {
    status?: string | null;
    updated_at?: string | null;
  } | null;
  /** Last message timestamp (ISO), if available. */
  last_message_at?: string | null;
  poster?: UserQualityInput | null;
  doer?: UserQualityInput | null;
};

const DAY = 86400000;
function daysSince(iso?: string | null): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / DAY;
}

export function calculateDealQuality(deal: DealQualityInput): QualityResult {
  const warnings: string[] = [];
  const positives: string[] = [];
  const recommendations: string[] = [];
  let score = 70;

  const status = deal.task.status || "open";
  const sinceUpdate = daysSince(deal.task.updated_at);

  // Stage-specific health checks
  if (status === "accepted") {
    const sinceAccept = daysSince(deal.task.updated_at);
    if (sinceAccept >= 2) {
      score -= 20;
      warnings.push("Task accepted but not funded yet");
      recommendations.push("Fund the task to keep your helper engaged.");
    } else if (sinceAccept >= 1) {
      score -= 8;
      warnings.push("Funding pending for over 24 hours");
    }
  }

  if (status === "funded" && sinceUpdate >= 2) {
    score -= 12;
    warnings.push("Funded but not started yet");
  }

  if (status === "in_progress") {
    if (sinceUpdate >= 5) {
      score -= 18;
      warnings.push("In progress for too long without an update");
      recommendations.push("Send a quick chat message to confirm progress.");
    } else {
      positives.push("Deal is actively in progress");
    }
  }

  if (status === "completed") {
    if (sinceUpdate >= 3) {
      score -= 12;
      warnings.push("Completed but payment not released yet");
      recommendations.push("Release payment so the doer gets paid promptly.");
    } else {
      positives.push("Awaiting payment release");
    }
  }

  if (status === "paid") {
    score += 10;
    positives.push("Payment released successfully");
  }

  if (status === "cancelled") {
    score -= 15;
    warnings.push("This deal was cancelled");
  }

  // Communication signal
  if (deal.last_message_at) {
    const sinceMsg = daysSince(deal.last_message_at);
    if (sinceMsg <= 1) {
      score += 6;
      positives.push("Recent communication");
    } else if (sinceMsg >= 4 && (status === "in_progress" || status === "funded")) {
      score -= 6;
      warnings.push("No messages exchanged recently");
    }
  } else if (status === "in_progress" || status === "funded") {
    recommendations.push("Use chat to coordinate — silence often leads to disputes.");
  }

  // Payment signal
  if (deal.payment) {
    if (deal.payment.status === "escrow") {
      score += 6;
      positives.push("Funds safely held in escrow");
    } else if (deal.payment.status === "refunded") {
      score -= 10;
      warnings.push("Payment was refunded");
    }
  }

  // Participant trust
  if (deal.poster) {
    const u = calculateUserQuality(deal.poster);
    if (u.level === "restricted" || u.level === "needs_attention") {
      score -= 10;
      warnings.push("Poster has trust signals worth reviewing");
    }
  }
  if (deal.doer) {
    const u = calculateUserQuality(deal.doer);
    if (u.level === "restricted" || u.level === "needs_attention") {
      score -= 10;
      warnings.push("Doer has trust signals worth reviewing");
    }
  }

  score = clamp(score);
  return { score, level: toLevel(score), warnings, positives, recommendations };
}
