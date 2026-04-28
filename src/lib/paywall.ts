/**
 * Paywall enforcement helpers.
 * Limits per spec:
 *  - Job applications/week: free=2, pro=7, premium=∞
 *  - Schedule contacts/week: free=0, pro=2, premium=∞
 */

export type PlanTier = "free" | "pro" | "premium";

interface MinimalProfile {
  plan_tier?: PlanTier | string | null;
}

export const APPLY_LIMITS: Record<PlanTier, number> = {
  free: 2,
  pro: 7,
  premium: Number.POSITIVE_INFINITY,
};

export const CONTACT_LIMITS: Record<PlanTier, number> = {
  free: 0,
  pro: 2,
  premium: Number.POSITIVE_INFINITY,
};

function tierOf(profile?: MinimalProfile | null): PlanTier {
  const t = (profile?.plan_tier ?? "free") as PlanTier;
  return t === "pro" || t === "premium" ? t : "free";
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
