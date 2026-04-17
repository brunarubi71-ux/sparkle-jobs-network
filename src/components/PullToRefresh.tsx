import { useEffect, useRef, useState, ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  threshold?: number;
}

/**
 * Lightweight pull-to-refresh wrapper.
 * Triggers when the user pulls down at the very top of the page.
 */
export default function PullToRefresh({ onRefresh, children, threshold = 70 }: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        startY.current = e.touches[0].clientY;
        ready.current = true;
      } else {
        ready.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!ready.current || startY.current === null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
        // Dampen the pull for a natural feel
        setPullDistance(Math.min(delta * 0.5, threshold * 1.5));
      }
    };

    const handleTouchEnd = async () => {
      if (!ready.current) return;
      ready.current = false;
      startY.current = null;
      if (pullDistance >= threshold && !refreshing) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, threshold, onRefresh, refreshing]);

  const indicatorOpacity = Math.min(pullDistance / threshold, 1);

  return (
    <>
      {(pullDistance > 0 || refreshing) && (
        <div
          className="fixed left-0 right-0 top-0 z-[700] flex items-center justify-center pointer-events-none"
          style={{
            height: refreshing ? 60 : pullDistance,
            opacity: refreshing ? 1 : indicatorOpacity,
            transition: refreshing ? "height 0.2s" : undefined,
          }}
        >
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-card shadow-elevated">
            <Loader2
              className={`h-5 w-5 text-primary ${refreshing ? "animate-spin" : ""}`}
              style={{ transform: refreshing ? undefined : `rotate(${pullDistance * 4}deg)` }}
            />
          </div>
        </div>
      )}
      {children}
    </>
  );
}
