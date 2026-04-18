import { motion } from "framer-motion";
import { Lock, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  evaluateBadges,
  getBadgesForAudience,
  getDisplayName,
  nextBadge,
  type PointBadge,
} from "@/lib/points";

interface Props {
  points: number;
  role: string;
  workerType?: string;
  identityApproved: boolean;
  /** When true, hide locked badges (used on PublicProfile). */
  publicView?: boolean;
}

export default function PointsBadgesSection({
  points,
  role,
  workerType,
  identityApproved,
  publicView = false,
}: Props) {
  const badges: PointBadge[] = getBadgesForAudience(role, workerType);
  const evaluated = evaluateBadges(badges, points, identityApproved);
  const visible = publicView ? evaluated.filter((b) => b.unlocked) : evaluated;
  const next = nextBadge(evaluated);

  if (publicView && visible.length === 0) return null;

  const progress = next ? Math.min(100, Math.round((points / next.threshold) * 100)) : 100;

  return (
    <div className="bg-card rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          {publicView ? "Badges" : "Your Badges"}
        </h3>
        {!publicView && (
          <div className="text-xs font-bold text-primary">
            {points} pts
          </div>
        )}
      </div>

      {!publicView && next && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>
              Next: {next.emoji} {getDisplayName(next, workerType)}
            </span>
            <span>
              {points}/{next.threshold}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {visible.map((b, idx) => {
          const name = getDisplayName(b, workerType);
          return (
            <motion.div
              key={b.id}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.04, type: "spring", stiffness: 220 }}
              className={`relative rounded-xl p-3 text-center border ${
                b.unlocked
                  ? "bg-gradient-to-br from-primary/15 to-accent/15 border-primary/30"
                  : "bg-muted/40 border-border opacity-70"
              }`}
            >
              <div className={`text-2xl mb-1 ${b.unlocked ? "" : "grayscale"}`}>{b.emoji}</div>
              <div
                className={`text-[10px] font-semibold leading-tight ${
                  b.unlocked ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {name}
              </div>
              {!b.unlocked && (
                <>
                  <div className="absolute top-1.5 right-1.5">
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-1">
                    {b.pointsRemaining > 0
                      ? `${b.pointsRemaining} more pts`
                      : "Verify identity"}
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
