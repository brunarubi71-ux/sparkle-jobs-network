import { useEffect } from "react";
import { toast } from "sonner";
import { POINT_LABELS, type PointReason } from "@/lib/points";

/**
 * Listens to global "shinely:points-awarded" CustomEvents and shows
 * an animated celebratory toast. Mount once at the app root.
 */
export default function PointsToast() {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { points: number; reason: PointReason };
      if (!detail || !detail.points) return;
      const label = POINT_LABELS[detail.reason] || "";
      toast.success(`🎉 +${detail.points} points! Keep it up!`, {
        description: label,
        duration: 3000,
        className: "border-primary/40 bg-gradient-to-r from-primary/10 to-accent/10",
      });
    };
    window.addEventListener("shinely:points-awarded", handler);
    return () => window.removeEventListener("shinely:points-awarded", handler);
  }, []);
  return null;
}
