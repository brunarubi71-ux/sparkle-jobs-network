// Platform protection: violation logging and penalty system
import { supabase } from "@/integrations/supabase/client";
import type { ViolationType } from "./contactFilter";

const PENALTY_THRESHOLDS = {
  WARNING: 1,      // 1st violation: warning only
  MILD: 3,         // 3 violations: slight visibility reduction
  MODERATE: 5,     // 5 violations: moderate penalty
  SEVERE: 10,      // 10 violations: heavy penalty
};

const VISIBILITY_PENALTIES: Record<string, number> = {
  WARNING: 1.0,
  MILD: 0.8,
  MODERATE: 0.5,
  SEVERE: 0.2,
};

export async function logViolation(
  userId: string,
  violationType: ViolationType,
  context: "chat" | "job_post" | "profile",
  messageSnippet?: string
): Promise<{ newScore: number; penaltyLevel: string }> {
  // Log the violation
  await supabase.from("platform_violations").insert({
    user_id: userId,
    violation_type: violationType,
    context,
    message_snippet: messageSnippet ? messageSnippet.substring(0, 100) : null,
    auto_penalty_applied: true,
  } as any);

  // Increment violation score
  const { data: profile } = await supabase
    .from("profiles")
    .select("violation_score")
    .eq("id", userId)
    .single();

  const currentScore = (profile as any)?.violation_score || 0;
  const newScore = currentScore + 1;

  // Determine penalty level
  let penaltyLevel = "WARNING";
  let visibility = 1.0;

  if (newScore >= PENALTY_THRESHOLDS.SEVERE) {
    penaltyLevel = "SEVERE";
    visibility = VISIBILITY_PENALTIES.SEVERE;
  } else if (newScore >= PENALTY_THRESHOLDS.MODERATE) {
    penaltyLevel = "MODERATE";
    visibility = VISIBILITY_PENALTIES.MODERATE;
  } else if (newScore >= PENALTY_THRESHOLDS.MILD) {
    penaltyLevel = "MILD";
    visibility = VISIBILITY_PENALTIES.MILD;
  }

  // Update profile
  await supabase
    .from("profiles")
    .update({
      violation_score: newScore,
      visibility_penalty: visibility,
    } as any)
    .eq("id", userId);

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
