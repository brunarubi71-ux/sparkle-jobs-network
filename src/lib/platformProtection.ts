// Platform protection: violation logging and penalty system
import { supabase } from "@/integrations/supabase/client";
import type { ViolationType } from "./contactFilter";

const PENALTY_THRESHOLDS = {
  WARNING: 1,      // 1st violation: warning only
  MILD: 3,         // 3 violations: slight visibility reduction
  MODERATE: 5,     // 5 violations: moderate penalty
  SEVERE: 10,      // 10 violations: heavy penalty
};

export async function logViolation(
  userId: string,
  violationType: ViolationType,
  context: "chat" | "job_post" | "profile",
  messageSnippet?: string
): Promise<{ newScore: number; penaltyLevel: string }> {
  // Server-side RPC inserts the violation against auth.uid() and bumps
  // violation_score / visibility_penalty atomically. The client cannot
  // bypass this to insert against another user or reset its own score.
  await supabase.rpc("record_self_violation" as any, {
    _violation_type: violationType,
    _context: context,
    _message_snippet: messageSnippet ?? null,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("violation_score")
    .eq("id", userId)
    .single();

  const newScore = (profile as any)?.violation_score ?? 0;

  let penaltyLevel = "WARNING";
  if (newScore >= PENALTY_THRESHOLDS.SEVERE) penaltyLevel = "SEVERE";
  else if (newScore >= PENALTY_THRESHOLDS.MODERATE) penaltyLevel = "MODERATE";
  else if (newScore >= PENALTY_THRESHOLDS.MILD) penaltyLevel = "MILD";

  return { newScore, penaltyLevel };
}

export function getPenaltyMessage(score: number, role: "cleaner" | "owner"): string | null {
  if (score < PENALTY_THRESHOLDS.WARNING) return null;

  if (role === "cleaner") {
    if (score >= PENALTY_THRESHOLDS.SEVERE) return "Your visibility has been severely reduced due to repeated violations. Stay on-platform to restore your ranking.";
    if (score >= PENALTY_THRESHOLDS.MODERATE) return "Your job visibility is reduced. Avoid sharing contact info to maintain your ranking.";
    if (score >= PENALTY_THRESHOLDS.MILD) return "Warning: Continued off-platform attempts will reduce your visibility.";
    return "Payments outside the app are not protected. Keep transactions on Shinely for safety.";
  } else {
    if (score >= PENALTY_THRESHOLDS.SEVERE) return "Your job postings have significantly reduced visibility due to policy violations.";
    if (score >= PENALTY_THRESHOLDS.MODERATE) return "Your job visibility is reduced. Use in-app communication for safe transactions.";
    if (score >= PENALTY_THRESHOLDS.MILD) return "Warning: Off-platform contact attempts affect your job visibility.";
    return "Jobs outside the app are not guaranteed. Stay on Shinely for protected transactions.";
  }
}
