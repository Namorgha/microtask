import { MapPin, Clock, Tag, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "./StarRating";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "./ConfidenceBadge";
import type { ConfidenceResult } from "@/lib/dealConfidence";
import { VerifiedBadges } from "@/components/verification/VerifiedBadge";

export interface TaskCardProps {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  location: string;
  distance?: string;
  posterName: string;
  posterRating: number;
  posterAvatar?: string;
  status: string;
  imageUrl?: string;
  confidence?: ConfidenceResult;
  posterIdentityVerified?: boolean;
  posterAddressVerified?: boolean;
  createdAt?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-success/10 text-success border-success/20" },
  accepted: { label: "Accepted", className: "bg-accent/10 text-accent border-accent/20" },
  "in-progress": { label: "In Progress", className: "bg-primary/10 text-primary border-primary/20" },
  in_progress: { label: "In Progress", className: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Completed", className: "bg-muted text-muted-foreground border-border" },
  paid: { label: "Paid", className: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function TaskCard({
  id, title, description, price, duration, category, location, distance, posterName, posterRating, status, imageUrl, confidence, posterIdentityVerified, posterAddressVerified, createdAt,
}: TaskCardProps) {
  const statusInfo = statusConfig[status] || { label: status, className: "" };
  const postedAgo = createdAt ? timeAgo(createdAt) : null;

  return (
    <Link to={`/tasks/${id}`} className="block group min-w-0">
      <Card className={cn(
        "overflow-hidden border border-border/60 bg-card transition-all duration-300",
        "hover:shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.15)] hover:-translate-y-1",
        "active:translate-y-0 active:shadow-md"
      )}>
        {/* Image */}
        {imageUrl && (
          <div className="relative h-44 overflow-hidden">
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            <Badge className={cn("absolute top-3 left-3 text-[11px] font-medium border", statusInfo.className)}>
              {statusInfo.label}
            </Badge>
            {confidence && (
              <div className="absolute top-3 right-3" onClick={(e) => e.preventDefault()}>
                <ConfidenceBadge result={confidence} size="sm" />
              </div>
            )}
          </div>
        )}

        <CardContent className="p-5">
          {/* Status + Category row (when no image) */}
          {!imageUrl && (
            <div className="flex items-center gap-2 mb-3">
              <Badge className={cn("text-[11px] font-medium border", statusInfo.className)}>
                {statusInfo.label}
              </Badge>
              <Badge variant="outline" className="text-[11px] capitalize gap-1 font-normal text-muted-foreground">
                <Tag className="h-3 w-3" />
                {category}
              </Badge>
              {confidence && (
                <div className="ml-auto" onClick={(e) => e.preventDefault()}>
                  <ConfidenceBadge result={confidence} size="sm" />
                </div>
              )}
            </div>
          )}

          {/* Title + Price */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-[15px] leading-snug text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-1">
                {title}
              </h3>
              <p className="text-[13px] text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                {description}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-flex items-baseline font-display">
                <span className="text-xs text-accent/70 mr-0.5">$</span>
                <span className="text-2xl font-bold text-accent">{price}</span>
              </span>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="truncate max-w-[120px]">{distance || location}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
              {duration} min
            </span>
            {imageUrl && (
              <Badge variant="outline" className="text-[11px] capitalize gap-1 font-normal text-muted-foreground ml-auto h-5">
                <Tag className="h-3 w-3" />
                {category}
              </Badge>
            )}
          </div>

          {/* Poster row */}
          <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2 pt-4 border-t border-border/60">
            <div className="h-7 w-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
              {posterName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[13px] font-medium text-foreground truncate min-w-0 max-w-[110px]">{posterName}</span>
            <VerifiedBadges identityVerified={posterIdentityVerified} addressVerified={posterAddressVerified} size="xs" />
            <div className="ml-auto">
              <StarRating rating={posterRating} size="sm" />
            </div>
          </div>

          {/* CTA row */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {postedAgo ? `Posted ${postedAgo}` : ""}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary group-hover:gap-1.5 transition-all">
              View details
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}
