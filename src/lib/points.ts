import { supabase } from "@/integrations/supabase/client";

export type PointReason =
  // Cleaner/Helper
  | "identity_verified"
  | "profile_complete"
  | "first_job_completed"
  | "job_completed"
  | "received_5_star"
  | "review_given_owner"
  | "no_cancellations_month"
  | "fast_hire_response"
  // Owner
  | "job_posted"
  | "owner_job_completed"
  | "review_given_cleaner"
  | "review_given_helper"
  | "fast_application_response";

export const POINT_VALUES: Record<PointReason, number> = {
  identity_verified: 30,
  profile_complete: 20,
  first_job_completed: 50,
  job_completed: 25,
  received_5_star: 20,
  review_given_owner: 15,
  no_cancellations_month: 25,
  fast_hire_response: 5,
  job_posted: 10,
  owner_job_completed: 25,
  review_given_cleaner: 15,
  review_given_helper: 15,
  fast_application_response: 5,
};

export const POINT_LABELS: Record<PointReason, string> = {
  identity_verified: "Identity verified",
  profile_complete: "Profile completed",
  first_job_completed: "First job completed!",
  job_completed: "Job completed",
  received_5_star: "5-star review received",
  review_given_owner: "Review given to owner",
  no_cancellations_month: "No cancellations this month",
  fast_hire_response: "Fast hire response",
  job_posted: "Job posted",
  owner_job_completed: "Job completed",
  review_given_cleaner: "Review given to cleaner",
  review_given_helper: "Review given to helper",
  fast_application_response: "Fast application response",
};

/** One-time reasons that can only be awarded once per user. */
const ONCE_PER_USER: PointReason[] = [
  "identity_verified",
  "first_job_completed",
];

/**
 * Award points to a user. Handles one-time reasons by checking history first.
 * Returns the number of points actually awarded (0 if duplicate-blocked).
 */
export async function awardPoints(userId: string, reason: PointReason): Promise<number> {
  if (!userId) return 0;
  const points = POINT_VALUES[reason];
  if (!points) return 0;

  // Use secure RPC — handles duplicate checks and atomic increment server-side
  const { data, error } = await supabase.rpc("award_points", {
    p_user_id: userId,
    p_points: points,
    p_reason: reason,
  });

  const awarded = error ? 0 : (data as number) ?? 0;

  // Broadcast for in-app toast
  if (awarded > 0 && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("shinely:points-awarded", { detail: { points: awarded, reason } })
    );
  }

  return awarded;
}

// ───────────────────────── Badges ─────────────────────────

export interface PointBadge {
  id: string;
  name: string;
  emoji: string;
  threshold: number;
  audience: "worker" | "owner" | "both";
  /** Special predicate (e.g. requires identity verified). */
  extraCheck?: (ctx: { identityApproved: boolean }) => boolean;
}

export const POINT_BADGES: PointBadge[] = [
  // Cleaner / Helper
  { id: "rising",    name: "Rising",         emoji: "⭐", threshold: 50,   audience: "worker" },
  { id: "top",       name: "Top",            emoji: "🏆", threshold: 200,  audience: "worker" },
  { id: "elite",     name: "Elite",          emoji: "💎", threshold: 500,  audience: "worker" },
  { id: "legend",    name: "Legend",         emoji: "👑", threshold: 1500, audience: "worker" },
  {
    id: "verified_pro",
    name: "Verified Pro",
    emoji: "✦",
    threshold: 100,
    audience: "worker",
    extraCheck: (c) => c.identityApproved,
  },
  // Owner
  { id: "trusted",   name: "Trusted Owner",  emoji: "🏠", threshold: 50,   audience: "owner" },
  { id: "fast",      name: "Fast Responder", emoji: "⚡", threshold: 300,  audience: "owner" },
  { id: "top_emp",   name: "Top Employer",   emoji: "⭐", threshold: 700,  audience: "owner" },
  { id: "vip",       name: "VIP Owner",      emoji: "💎", threshold: 1500, audience: "owner" },
];

export function getBadgesForAudience(role: string, workerType?: string): PointBadge[] {
  const isOwner = role === "owner";
  return POINT_BADGES.filter((b) => (isOwner ? b.audience === "owner" : b.audience === "worker"));
}

export function getDisplayName(badge: PointBadge, workerType?: string): string {
  if (badge.audience === "worker" && ["rising", "top", "elite", "legend"].includes(badge.id)) {
    return `${badge.name} ${workerType === "helper" ? "Helper" : "Cleaner"}`;
  }
  return badge.name;
}

export interface UnlockedBadge extends PointBadge {
  unlocked: boolean;
  pointsRemaining: number;
}

export function evaluateBadges(
  badges: PointBadge[],
  points: number,
  identityApproved: boolean
): UnlockedBadge[] {
  return badges.map((b) => {
    const meetsPoints = points >= b.threshold;
    const meetsExtra = b.extraCheck ? b.extraCheck({ identityApproved }) : true;
    const unlocked = meetsPoints && meetsExtra;
    return {
      ...b,
      unlocked,
      pointsRemaining: Math.max(0, b.threshold - points),
    };
  });
}

/** Returns the next badge the user is working toward (or null if all unlocked). */
export function nextBadge(unlocked: UnlockedBadge[]): UnlockedBadge | null {
  const locked = unlocked.filter((b) => !b.unlocked).sort((a, b) => a.threshold - b.threshold);
  return locked[0] || null;
}
