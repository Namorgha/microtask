import { ShieldCheck, ShieldAlert, ShieldQuestion, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  type ConfidenceResult,
  type ConfidenceLevel,
  LEVEL_LABEL,
} from "@/lib/dealConfidence";

interface Props {
  result: ConfidenceResult;
  size?: "sm" | "md";
  showScore?: boolean;
  withPopover?: boolean;
  className?: string;
}

const LEVEL_STYLES: Record<ConfidenceLevel, { badge: string; icon: any; iconColor: string }> = {
  high: {
    badge: "bg-success/10 text-success border-success/30",
    icon: ShieldCheck,
    iconColor: "text-success",
  },
  medium: {
    badge: "bg-accent/10 text-accent border-accent/30",
    icon: ShieldQuestion,
    iconColor: "text-accent",
  },
  low: {
    badge: "bg-destructive/10 text-destructive border-destructive/30",
    icon: ShieldAlert,
    iconColor: "text-destructive",
  },
};

export function ConfidenceBadge({ result, size = "sm", showScore = false, withPopover = true, className }: Props) {
  const styles = LEVEL_STYLES[result.level];
  const Icon = styles.icon;

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium transition-colors",
        styles.badge,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      <span className="capitalize">{result.level}</span>
      {showScore && <span className="opacity-70">· {result.score}</span>}
    </span>
  );

  if (!withPopover) return badge;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button type="button" className="cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">
          {badge}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 p-3" align="start">
        <ConfidenceMini result={result} />
      </HoverCardContent>
    </HoverCard>
  );
}

function ConfidenceMini({ result }: { result: ConfidenceResult }) {
  const styles = LEVEL_STYLES[result.level];
  const Icon = styles.icon;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", styles.iconColor)} />
        <span className="font-display font-semibold text-sm">{LEVEL_LABEL[result.level]}</span>
        <span className="ml-auto text-xs text-muted-foreground">{result.score}/100</span>
      </div>
      <p className="text-xs text-muted-foreground">{result.summary}</p>
      <ul className="space-y-1">
        {result.factors.slice(0, 4).map((f) => (
          <li key={f.key} className="flex items-start gap-1.5 text-[12px]">
            {f.positive ? (
              <Check className="h-3 w-3 text-success mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" />
            )}
            <span className="text-foreground/80">{f.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}