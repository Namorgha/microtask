import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, Wrench, Truck, ShoppingCart, Paintbrush, Code, BookOpen, HelpCircle } from "lucide-react";

const categoryIcons: Record<string, React.ElementType> = {
  delivery: Truck,
  cleaning: Paintbrush,
  repair: Wrench,
  shopping: ShoppingCart,
  tech: Code,
  tutoring: BookOpen,
  moving: Package,
  other: HelpCircle,
};

export const TASK_CATEGORIES = [
  "delivery", "cleaning", "repair", "shopping", "tech", "tutoring", "moving", "other"
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export function CategoryBadge({ category, selected, onClick }: { category: string; selected?: boolean; onClick?: () => void }) {
  const Icon = categoryIcons[category] || HelpCircle;
  return (
    <Badge
      variant={selected ? "default" : "outline"}
      className={cn("cursor-pointer capitalize gap-1 transition-colors", onClick && "hover:bg-primary hover:text-primary-foreground")}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {category}
    </Badge>
  );
}
