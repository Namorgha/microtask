import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

const sizes = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-6 w-6" };

export function StarRating({ rating, maxStars = 5, size = "md", interactive = false, onRate }: StarRatingProps) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          className={cn(
            sizes[size],
            i < rating ? "fill-accent text-accent" : "text-muted-foreground/30",
            interactive && "cursor-pointer hover:text-accent transition-colors"
          )}
          onClick={() => interactive && onRate?.(i + 1)}
        />
      ))}
    </div>
  );
}
