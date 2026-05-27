DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  (auth.uid() = id)
  AND (role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid()))
  AND (is_premium = (SELECT p.is_premium FROM profiles p WHERE p.id = auth.uid()))
  AND (plan_tier = (SELECT p.plan_tier FROM profiles p WHERE p.id = auth.uid()))
  AND (violation_score = (SELECT p.violation_score FROM profiles p WHERE p.id = auth.uid()))
  AND (visibility_penalty = (SELECT p.visibility_penalty FROM profiles p WHERE p.id = auth.uid()))
  AND (wallet_balance = (SELECT p.wallet_balance FROM profiles p WHERE p.id = auth.uid()))
  AND (points = (SELECT p.points FROM profiles p WHERE p.id = auth.uid()))
  AND (jobs_used_today = (SELECT p.jobs_used_today FROM profiles p WHERE p.id = auth.uid()))
  AND (free_contacts_used = (SELECT p.free_contacts_used FROM profiles p WHERE p.id = auth.uid()))
  AND (free_trial_started_at IS NOT DISTINCT FROM (SELECT p.free_trial_started_at FROM profiles p WHERE p.id = auth.uid()))
  AND (free_trial_ends_at IS NOT DISTINCT FROM (SELECT p.free_trial_ends_at FROM profiles p WHERE p.id = auth.uid()))
  AND (premium_status IS NOT DISTINCT FROM (SELECT p.premium_status FROM profiles p WHERE p.id = auth.uid()))
  AND ((identity_status = (SELECT p.identity_status FROM profiles p WHERE p.id = auth.uid())) OR (identity_status = 'pending'))
);