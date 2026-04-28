import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tier?: string | null;
  className?: string;
}

/**
 * Badge showing the user's subscription tier.
 *  - free   → renders nothing
 *  - pro    → blue "Pro"
 *  - premium → purple "Premium ⭐"
 */
export default function PlanBadge({ tier, className }: Props) {
  if (tier === "pro") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-500/15 text-blue-600 dark:text-blue-400",
          className,
        )}
      >
        Pro
      </span>
    );
  }
  if (tier === "premium") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary",
          className,
        )}
      >
        Premium <Star className="w-2.5 h-2.5 fill-current" />
      </span>
    );
  }
  return null;
}
