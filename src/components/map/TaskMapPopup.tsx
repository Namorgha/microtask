import { MapPin, ArrowRight } from "lucide-react";

interface TaskMapPopupProps {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  distance: string;
  posterName: string;
  onOpen: (id: string) => void;
}

// Rendered into a Leaflet popup (outside the app's React tree), so it uses
// theme CSS variables and receives navigation as a callback.
export function TaskMapPopup({ id, title, description, price, category, distance, posterName, onOpen }: TaskMapPopupProps) {
  return (
    <div className="font-sans text-card-foreground">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
          {category}
        </span>
        <span className="ml-auto font-display text-lg font-bold text-accent">${price}</span>
      </div>
      <h3 className="mb-1 text-sm font-semibold leading-snug line-clamp-2">{title}</h3>
      <p className="mb-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">{description}</p>
      <div className="mb-3 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{distance}</span>
        <span>·</span>
        <span className="truncate">{posterName}</span>
      </div>
      <button
        type="button"
        onClick={() => onOpen(id)}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
      >
        View task <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
