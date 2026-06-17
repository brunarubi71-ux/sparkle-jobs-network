-- Lock additional privileged fields on profile self-update
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND is_premium = (SELECT p.is_premium FROM public.profiles p WHERE p.id = auth.uid())
  AND plan_tier = (SELECT p.plan_tier FROM public.profiles p WHERE p.id = auth.uid())
  AND violation_score = (SELECT p.violation_score FROM public.profiles p WHERE p.id = auth.uid())
  AND visibility_penalty = (SELECT p.visibility_penalty FROM public.profiles p WHERE p.id = auth.uid())
  AND wallet_balance = (SELECT p.wallet_balance FROM public.profiles p WHERE p.id = auth.uid())
  AND points = (SELECT p.points FROM public.profiles p WHERE p.id = auth.uid())
  AND jobs_used_today = (SELECT p.jobs_used_today FROM public.profiles p WHERE p.id = auth.uid())
  AND free_contacts_used = (SELECT p.free_contacts_used FROM public.profiles p WHERE p.id = auth.uid())
  AND jobs_completed = (SELECT p.jobs_completed FROM public.profiles p WHERE p.id = auth.uid())
  AND total_earnings = (SELECT p.total_earnings FROM public.profiles p WHERE p.id = auth.uid())
  AND schedules_unlocked = (SELECT p.schedules_unlocked FROM public.profiles p WHERE p.id = auth.uid())
  AND NOT (free_trial_started_at IS DISTINCT FROM (SELECT p.free_trial_started_at FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (free_trial_ends_at IS DISTINCT FROM (SELECT p.free_trial_ends_at FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (premium_status IS DISTINCT FROM (SELECT p.premium_status FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (suspension_until IS DISTINCT FROM (SELECT p.suspension_until FROM public.profiles p WHERE p.id = auth.uid()))
  AND cancellation_violations = (SELECT p.cancellation_violations FROM public.profiles p WHERE p.id = auth.uid())
  AND (
    identity_status = (SELECT p.identity_status FROM public.profiles p WHERE p.id = auth.uid())
    OR identity_status = 'pending'
  )
);

-- Allow authenticated users to browse open/applied jobs (marketplace listings)
DROP POLICY IF EXISTS "Authenticated users can browse open jobs" ON public.jobs;
CREATE POLICY "Authenticated users can browse open jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (status IN ('open', 'applied'));
