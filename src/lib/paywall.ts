/**
 * Paywall enforcement helpers.
 * All tiers are unlimited during the free-growth phase (until ~1000 users).
 * Subscriptions remain optional; only the 10% platform fee applies.
 */

export type PlanTier = "free" | "pro" | "premium";

interface MinimalProfile {
  plan_tier?: PlanTier | string | null;
  is_premium?: boolean | null;
}

export const APPLY_LIMITS: Record<PlanTier, number> = {
  free: Number.POSITIVE_INFINITY,
  pro: Number.POSITIVE_INFINITY,
  premium: Number.POSITIVE_INFINITY,
};

export const CONTACT_LIMITS: Record<PlanTier, number> = {
  free: Number.POSITIVE_INFINITY,
  pro: Number.POSITIVE_INFINITY,
  premium: Number.POSITIVE_INFINITY,
};

function tierOf(profile?: MinimalProfile | null): PlanTier {
  const t = (profile?.plan_tier ?? "free") as PlanTier;
  if (t === "pro" || t === "premium") return t;
  // Fallback: if webhook set is_premium=true but plan_tier hasn't synced yet, treat as "pro"
  if (profile?.is_premium) return "pro";
  return "free";
}

export function getApplyLimit(profile?: MinimalProfile | null): number {
  return APPLY_LIMITS[tierOf(profile)];
}

export function getContactLimit(profile?: MinimalProfile | null): number {
  return CONTACT_LIMITS[tierOf(profile)];
}

export function canApplyToJob(
  profile: MinimalProfile | null | undefined,
  weeklyApplications: number,
): boolean {
  const limit = getApplyLimit(profile);
  if (!Number.isFinite(limit)) return true;
  return weeklyApplications < limit;
}

export function canViewScheduleContact(
  profile: MinimalProfile | null | undefined,
  weeklyContacts: number,
): boolean {
  const limit = getContactLimit(profile);
  if (!Number.isFinite(limit)) return true;
  return weeklyContacts < limit;
}

/** ISO date (YYYY-MM-DD) for Monday of the current week. */
export function weekStartISO(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
