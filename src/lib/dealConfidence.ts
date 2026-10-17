/**
 * Deal Confidence Score — deterministic, rule-based trust layer.
 *
 * calculateDealConfidence(input) -> { score, level, summary, factors, weights }
 *
 * Score is 0–100. Levels:
 *   80–100 = high
 *   50–79  = medium
 *   0–49   = low
 */

export type ConfidenceLevel = "high" | "medium" | "low";

export type ConfidenceFactor = {
  key: string;
  label: string;
  /** Positive => trust signal; Negative => warning */
  delta: number;
  positive: boolean;
};

export type ConfidenceResult = {
  score: number; // 0–100
  level: ConfidenceLevel;
  summary: string;
  factors: ConfidenceFactor[];
  /** Friendly suggestions to improve the score (poster-side). */
  suggestions: string[];
};

export type ConfidenceTask = {
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
  status?: string | null;
  created_at?: string | null;
};

export type ConfidenceProfile = {
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  reputation_score?: number | null;
  total_reviews_count?: number | null;
  completed_tasks_count?: number | null;
  banned_at?: string | null;
  created_at?: string | null;
  email_verified?: boolean | null;
};

export type ConfidenceInput = {
  task: ConfidenceTask;
  poster?: ConfidenceProfile | null;
  requester?: ConfidenceProfile | null;
  /** True when an escrow payment exists in funded/escrow state. */
  funded?: boolean;
};

/** Tunable weights — keep small so total stays ~100. */
export const CONFIDENCE_WEIGHTS = {
  titleClear: 8,
  descriptionGood: 12,
  priceRealistic: 8,
  categoryValid: 4,
  locationValid: 6,
  imagePresent: 4,
  posterProfile: 8,
  posterVerified: 6,
  posterHistory: 12,
  posterRating: 10,
  posterAccountAge: 4,
  posterFlagged: -25,
  funded: 8,
} as const;

const VAGUE_TITLES = ["help", "task", "need", "need help", "stuff", "thing", "something", "asap", "urgent"];

/** Realistic $/min ranges per category. */
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function calculateDealConfidence(input: ConfidenceInput): ConfidenceResult {
  const { task, poster, funded } = input;
  const W = CONFIDENCE_WEIGHTS;
  const factors: ConfidenceFactor[] = [];
  const suggestions: string[] = [];
  let score = 50; // baseline

  // ---------- Task quality ----------
  const title = (task.title || "").trim();
  const titleLower = title.toLowerCase();
  const titleWords = title.split(/\s+/).filter(Boolean);
  const titleVague = VAGUE_TITLES.some((v) => titleLower === v || titleLower.startsWith(v + " "));
  if (title.length >= 12 && titleWords.length >= 3 && !titleVague) {
    score += W.titleClear;
    factors.push({ key: "title", label: "Clear, specific title", delta: W.titleClear, positive: true });
  } else {
    score -= W.titleClear / 2;
    factors.push({ key: "title", label: "Title is short or vague", delta: -W.titleClear / 2, positive: false });
    suggestions.push("Use a more specific task title (at least 3 words).");
  }

  const desc = (task.description || "").trim();
  if (desc.length >= 120) {
    score += W.descriptionGood;
    factors.push({ key: "description", label: "Detailed description", delta: W.descriptionGood, positive: true });
  } else if (desc.length >= 50) {
    score += W.descriptionGood / 2;
    factors.push({ key: "description", label: "Description is okay", delta: W.descriptionGood / 2, positive: true });
    suggestions.push("Add more detail to your description to increase trust.");
  } else {
    score -= W.descriptionGood / 2;
    factors.push({ key: "description", label: "Description is too short", delta: -W.descriptionGood / 2, positive: false });
    suggestions.push("Write at least a few sentences explaining what needs to be done.");
  }

  // Price realism
  const price = Number(task.price || 0);
  const duration = Number(task.duration || 0);
  const cat = (task.category || "other").toLowerCase();
  const rate = CATEGORY_RATES[cat] || CATEGORY_RATES.other;
  if (price > 0 && duration > 0) {
    const perMin = price / duration;
    if (perMin >= rate.min && perMin <= rate.max) {
      score += W.priceRealistic;
      factors.push({ key: "price", label: "Price looks fair for the work", delta: W.priceRealistic, positive: true });
    } else if (perMin < rate.min) {
      score -= W.priceRealistic / 2;
      factors.push({ key: "price", label: "Price seems unusually low", delta: -W.priceRealistic / 2, positive: false });
      suggestions.push("A more realistic price may improve confidence.");
    } else {
      score -= W.priceRealistic / 2;
      factors.push({ key: "price", label: "Price seems unusually high", delta: -W.priceRealistic / 2, positive: false });
    }
  }

  // Category
  if (task.category && task.category !== "other") {
    score += W.categoryValid;
    factors.push({ key: "category", label: "Category selected", delta: W.categoryValid, positive: true });
  }

  // Location
  const hasCoords = typeof task.lat === "number" && typeof task.lng === "number" && (task.lat !== 0 || task.lng !== 0);
  if (hasCoords && (task.location || "").trim().length > 2) {
    score += W.locationValid;
    factors.push({ key: "location", label: "Verified location", delta: W.locationValid, positive: true });
  } else {
    score -= W.locationValid / 2;
    factors.push({ key: "location", label: "Weak or missing location", delta: -W.locationValid / 2, positive: false });
  }

  // Images (bonus for visual-relevant categories)
  const visualCats = new Set(["repair", "cleaning", "moving", "delivery", "shopping"]);
  const hasImages = (task.images || []).length > 0;
  if (hasImages) {
    score += W.imagePresent;
    factors.push({ key: "images", label: "Photos included", delta: W.imagePresent, positive: true });
  } else if (visualCats.has(cat)) {
    suggestions.push("Add a photo to help others understand the task.");
  }

  // Flagged content
  if (task.flagged) {
    score -= 30;
    factors.push({ key: "flagged", label: "Task has been flagged", delta: -30, positive: false });
  }

  // ---------- Poster trust ----------
  if (poster) {
    const profileFields = [poster.full_name, poster.avatar_url, poster.bio, poster.location].filter(
      (f) => typeof f === "string" && f.trim().length > 0
    ).length;
    if (profileFields >= 3) {
      score += W.posterProfile;
      factors.push({ key: "profile", label: "Complete profile", delta: W.posterProfile, positive: true });
    } else {
      score -= W.posterProfile / 2;
      factors.push({ key: "profile", label: "Profile is incomplete", delta: -W.posterProfile / 2, positive: false });
      suggestions.push("Complete your profile to appear more trustworthy.");
    }

    if (poster.email_verified) {
      score += W.posterVerified;
      factors.push({ key: "verified", label: "Verified account", delta: W.posterVerified, positive: true });
    }

    const completed = Number(poster.completed_tasks_count || 0);
    if (completed >= 5) {
      score += W.posterHistory;
      factors.push({ key: "history", label: `${completed} tasks completed`, delta: W.posterHistory, positive: true });
    } else if (completed >= 1) {
      score += W.posterHistory / 2;
      factors.push({ key: "history", label: "Some completion history", delta: W.posterHistory / 2, positive: true });
    } else {
      factors.push({ key: "history", label: "New user with limited history", delta: 0, positive: false });
    }

    const reviews = Number(poster.total_reviews_count || 0);
    const rating = Number(poster.reputation_score || 0);
    if (reviews >= 3 && rating >= 4.2) {
      score += W.posterRating;
      factors.push({ key: "rating", label: `Highly rated (${rating.toFixed(1)}★)`, delta: W.posterRating, positive: true });
    } else if (reviews >= 1 && rating < 3) {
      score -= W.posterRating / 2;
      factors.push({ key: "rating", label: `Low rating (${rating.toFixed(1)}★)`, delta: -W.posterRating / 2, positive: false });
    }

    if (poster.created_at) {
      const days = (Date.now() - new Date(poster.created_at).getTime()) / 86400000;
      if (days >= 30) {
        score += W.posterAccountAge;
        factors.push({ key: "age", label: "Established account", delta: W.posterAccountAge, positive: true });
      }
    }

    if (poster.banned_at) {
      score += W.posterFlagged;
      factors.push({ key: "banned", label: "Account is restricted", delta: W.posterFlagged, positive: false });
    }
  }

  // ---------- Deal-stage signals ----------
  if (funded) {
    score += W.funded;
    factors.push({ key: "funded", label: "Payment is in escrow", delta: W.funded, positive: true });
  }

  score = Math.round(clamp(score, 0, 100));
  const level: ConfidenceLevel = score >= 80 ? "high" : score >= 50 ? "medium" : "low";

  const summary =
    level === "high"
      ? "Clear task details and trusted poster."
      : level === "medium"
      ? "Looks valid, but a few signals could be stronger."
      : "Low trust signals — review carefully before proceeding.";

  // Sort factors: warnings first when low/medium, positives first when high
  factors.sort((a, b) => {
    if (level === "high") return Number(b.positive) - Number(a.positive) || b.delta - a.delta;
    return Number(a.positive) - Number(b.positive) || a.delta - b.delta;
  });

  return { score, level, summary, factors, suggestions };
}

export const LEVEL_LABEL: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};