import { ShieldCheck, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  identityVerified?: boolean | null;
  addressVerified?: boolean | null;
  size?: "xs" | "sm";
  className?: string;
};

export function VerifiedBadges({ identityVerified, addressVerified, size = "sm", className }: Props) {
  if (!identityVerified && !addressVerified) return null;
  const iconSize = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";
  const padding = size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {identityVerified && (
        <Badge
          variant="outline"
          title="Verified Citizen — identity confirmed by platform review"
          className={cn("gap-1 border-primary/30 bg-primary/10 text-primary font-semibold", padding)}
        >
          <ShieldCheck className={iconSize} /> Verified
        </Badge>
      )}
      {addressVerified && (
        <Badge
          variant="outline"
          title="Address Confirmed — address verified by platform review"
          className={cn("gap-1 border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold", padding)}
        >
          <MapPin className={iconSize} /> Address
        </Badge>
      )}
    </div>
  );
}