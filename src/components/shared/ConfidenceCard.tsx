import { ShieldCheck, ShieldAlert, ShieldQuestion, Check, AlertTriangle, Info, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  type ConfidenceResult,
  type ConfidenceLevel,
  LEVEL_LABEL,
} from "@/lib/dealConfidence";

interface Props {
  result: ConfidenceResult;
  /** Compact variant for sidebars / request flows */
  compact?: boolean;
  /** Show admin-level breakdown with deltas */
  admin?: boolean;
  showSuggestions?: boolean;
}

const LEVEL_META: Record<
  ConfidenceLevel,
  { icon: any; ring: string; bar: string; chipBg: string; iconColor: string }
> = {
  high: {
    icon: ShieldCheck,
    ring: "ring-success/30 bg-success/5",
    bar: "bg-success",
    chipBg: "bg-success/10 text-success border-success/30",
    iconColor: "text-success",
  },
  medium: {
    icon: ShieldQuestion,
    ring: "ring-accent/30 bg-accent/5",
    bar: "bg-accent",
    chipBg: "bg-accent/10 text-accent border-accent/30",
    iconColor: "text-accent",
  },
  low: {
    icon: ShieldAlert,
    ring: "ring-destructive/30 bg-destructive/5",
    bar: "bg-destructive",
    chipBg: "bg-destructive/10 text-destructive border-destructive/30",
    iconColor: "text-destructive",
  },
};

export function ConfidenceCard({ result, compact = false, admin = false, showSuggestions = true }: Props) {
  const meta = LEVEL_META[result.level];
  const Icon = meta.icon;

  return (
    <Card className={cn("ring-1", meta.ring)}>
      <CardContent className={cn(compact ? "p-3.5 space-y-3" : "p-5 space-y-4")}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", meta.chipBg)}>
            <Icon className={cn("h-5 w-5", meta.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-sm">Deal confidence</h3>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  meta.chipBg
                )}
              >
                {LEVEL_LABEL[result.level]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{result.summary}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-xl font-bold leading-none">{result.score}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">/ 100</div>
          </div>
        </div>

        {/* Bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", meta.bar)}
            style={{ width: `${result.score}%` }}
          />
        </div>

        {/* Trust signals */}
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {result.factors.slice(0, admin ? 20 : 6).map((f) => (
            <li key={f.key} className="flex items-start gap-2 text-[12.5px]">
              {f.positive ? (
                <Check className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
              )}
              <span className="text-foreground/85 leading-snug flex-1">{f.label}</span>
              {admin && (
                <span
                  className={cn(
                    "text-[10px] font-mono shrink-0",
                    f.delta > 0 ? "text-success" : f.delta < 0 ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {f.delta > 0 ? "+" : ""}
                  {f.delta}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Suggestions */}
        {showSuggestions && result.suggestions.length > 0 && (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-accent" />
              <span className="text-[11px] font-medium text-foreground/80">Tips to boost confidence</span>
            </div>
            <ul className="space-y-1">
              {result.suggestions.slice(0, 3).map((s, i) => (
                <li key={i} className="text-[12px] text-muted-foreground flex items-start gap-1.5">
                  <span className="text-accent">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Low confidence warning (non-blocking) */}
        {result.level === "low" && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-2.5">
            <Info className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-[12px] text-foreground/85 leading-snug">
              This deal has limited trust signals. You can still proceed, but review the details and chat carefully before paying.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}