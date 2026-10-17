import { AlertTriangle, CheckCircle2, Lightbulb, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QualityResult, QualityLevel } from "@/lib/qualityEngine";
import { LEVEL_LABEL } from "@/lib/qualityEngine";

const TONE_CLASS: Record<QualityLevel, string> = {
  strong: "border-success/40 bg-success/5 text-foreground",
  good: "border-primary/40 bg-primary/5 text-foreground",
  new: "border-border bg-muted/40 text-foreground",
  needs_attention: "border-warning/50 bg-warning/10 text-foreground",
  restricted: "border-destructive/50 bg-destructive/10 text-foreground",
};

const BADGE_CLASS: Record<QualityLevel, string> = {
  strong: "bg-success/15 text-success border-success/30",
  good: "bg-primary/15 text-primary border-primary/30",
  new: "bg-muted text-muted-foreground border-border",
  needs_attention: "bg-warning/20 text-warning-foreground border-warning/40",
  restricted: "bg-destructive/15 text-destructive border-destructive/40",
};

interface QualityHintsProps {
  result: QualityResult;
  title?: string;
  className?: string;
  showScore?: boolean;
  compact?: boolean;
}

export function QualityHints({ result, title = "Quality check", className, showScore = true, compact = false }: QualityHintsProps) {
  const empty =
    result.warnings.length === 0 &&
    result.positives.length === 0 &&
    result.recommendations.length === 0;
  if (empty) return null;

  return (
    <div className={cn("rounded-xl border p-4 text-sm", TONE_CLASS[result.level], className)}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 font-display font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {title}
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", BADGE_CLASS[result.level])}>
          {LEVEL_LABEL[result.level]}
          {showScore && <span className="opacity-70">· {result.score}</span>}
        </span>
      </div>

      {!compact && result.positives.length > 0 && (
        <ul className="space-y-1 mb-2">
          {result.positives.slice(0, 3).map((p) => (
            <li key={p} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}

      {result.warnings.length > 0 && (
        <ul className="space-y-1 mb-2">
          {result.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      {result.recommendations.length > 0 && (
        <ul className="space-y-1">
          {result.recommendations.slice(0, 3).map((r) => (
            <li key={r} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
