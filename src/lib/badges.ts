import { supabase } from "@/integrations/supabase/client";

export interface BadgeDefinition {
  name: string;
  emoji: string;
  description_key: string;
  check: (stats: { jobsCompleted: number; avgRating: number; totalEarnings: number }) => boolean;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { name: "First Job", emoji: "🎯", description_key: "badge.first_job", check: (s) => s.jobsCompleted >= 1 },
  { name: "Rising Cleaner", emoji: "⭐", description_key: "badge.rising", check: (s) => s.jobsCompleted >= 10 },
  { name: "Top Cleaner", emoji: "🌟", description_key: "badge.top", check: (s) => s.jobsCompleted >= 25 },
  { name: "Elite Cleaner", emoji: "💎", description_key: "badge.elite", check: (s) => s.jobsCompleted >= 50 },
  { name: "Rising Helper", emoji: "🤝", description_key: "badge.rising_helper", check: (s) => s.jobsCompleted >= 10 },
  { name: "Top Helper", emoji: "💜", description_key: "badge.top_helper", check: (s) => s.jobsCompleted >= 25 },
  { name: "Elite Helper", emoji: "💠", description_key: "badge.elite_helper", check: (s) => s.jobsCompleted >= 50 },
  { name: "5-Star Pro", emoji: "🏆", description_key: "badge.five_star", check: (s) => s.avgRating >= 4.8 && s.jobsCompleted >= 5 },
  { name: "High Earner", emoji: "💰", description_key: "badge.high_earner", check: (s) => s.totalEarnings >= 1000 },
  { name: "Top Earner", emoji: "🤑", description_key: "badge.top_earner", check: (s) => s.totalEarnings >= 5000 },
];

export async function syncBadges(
  userId: string,
  stats: { jobsCompleted: number; avgRating: number; totalEarnings: number },
  workerType: "cleaner" | "helper" = "cleaner"
) {
  const { data: existing } = await supabase.from("rewards").select("badge_name").eq("user_id", userId);
  const existingNames = new Set((existing || []).map(r => r.badge_name));

  const newBadges = BADGE_DEFINITIONS.filter(b => b.check(stats) && !existingNames.has(b.name));

  if (newBadges.length > 0) {
    await supabase.from("rewards").insert(
      newBadges.map(b => ({ user_id: userId, badge_name: b.name }))
    );
  }

  return newBadges;
}
