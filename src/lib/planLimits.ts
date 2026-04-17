/**
 * Plan limits and helpers for Free / Pro / Premium tiers.
 *
 * Rules:
 *  - Free:    1 job/week,  0 contacts ever, 10% fee, no urgent jobs
 *  - Pro:     5 jobs/week, 1 contact unlock (single, lifetime), 10% fee, urgent allowed
 *  - Premium: unlimited jobs, unlimited contacts, 5% fee, all jobs
 */

export type PlanTier = "free" | "pro" | "premium";

export interface PlanLimits {
  maxJobsPerWeek: number; // Number.POSITIVE_INFINITY for unlimited
  maxContacts: number;    // Lifetime cap. Number.POSITIVE_INFINITY for unlimited
  feePercent: number;
  canSeeUrgentJobs: boolean;
}

export function getPlanLimits(tier?: string | null): PlanLimits {
  switch (tier) {
    case "premium":
      return {
        maxJobsPerWeek: Number.POSITIVE_INFINITY,
        maxContacts: Number.POSITIVE_INFINITY,
        feePercent: 5,
        canSeeUrgentJobs: true,
      };
    case "pro":
      return {
        maxJobsPerWeek: 5,
        maxContacts: 1,
        feePercent: 10,
        canSeeUrgentJobs: true,
      };
    default:
      return {
        maxJobsPerWeek: 1,
        maxContacts: 0,
        feePercent: 10,
        canSeeUrgentJobs: false,
      };
  }
}

/**
 * Returns the ISO date (YYYY-MM-DD) of the Monday starting the week of the given date.
 * Week starts on Monday.
 */
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Given the persisted `jobs_used_date` (YYYY-MM-DD) and `jobs_used_today` counter,
 * returns the count of jobs used during the CURRENT week. If the stored date is
 * outside the current week, the counter is considered reset (returns 0).
 */
export function getJobsUsedThisWeek(
  jobsUsedDate: string | null | undefined,
  jobsUsedToday: number | null | undefined,
): number {
  if (!jobsUsedDate) return 0;
  const weekStart = getWeekStart();
  // jobsUsedDate is in same week if it's >= Monday of current week
  if (jobsUsedDate >= weekStart) return jobsUsedToday ?? 0;
  return 0;
}
