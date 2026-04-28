import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Compact banner shown while the user is on a free trial.
 * Reads profile.premium_status === 'trialing' and free_trial_ends_at.
 */
export default function TrialBanner() {
  const { profile } = useAuth();
  if (!profile) return null;
  const status = (profile as any).premium_status;
  const endsAt = (profile as any).free_trial_ends_at as string | null;
  if (status !== "trialing" || !endsAt) return null;

  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));

  return (
    <Link
      to="/premium"
      className="block mx-4 mt-3 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
    >
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" />
        {days} {days === 1 ? "day" : "days"} left in your free trial · Manage plan →
      </span>
    </Link>
  );
}
