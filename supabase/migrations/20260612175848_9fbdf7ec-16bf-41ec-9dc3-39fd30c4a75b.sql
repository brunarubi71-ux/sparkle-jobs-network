
-- 1) Tighten profiles UPDATE policy: also lock suspension_until and cancellation_violations
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

-- 2) Harden credit_wallet: explicitly block self-credit by non-service_role/non-admin,
--    and require the job to be 'completed' for owner payouts.
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id uuid, p_amount numeric, p_description text, p_job_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_role text := auth.role();
  v_is_payout boolean := false;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF v_role <> 'service_role' AND NOT public.is_admin(v_caller) THEN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    -- Block self-credit entirely: legitimate self-credits only come from
    -- the Stripe webhook (service_role).
    IF p_user_id = v_caller THEN
      RAISE EXCEPTION 'Self-credit is not permitted';
    END IF;
    IF p_job_id IS NULL THEN
      RAISE EXCEPTION 'Not authorized: job context required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.jobs
      WHERE id = p_job_id
        AND owner_id = v_caller
        AND status = 'completed'
    ) THEN
      RAISE EXCEPTION 'Not authorized: caller does not own a completed job';
    END IF;
    IF NOT (
      EXISTS (
        SELECT 1 FROM public.jobs
        WHERE id = p_job_id AND hired_cleaner_id = p_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.job_applications
        WHERE job_id = p_job_id
          AND cleaner_id = p_user_id
          AND status IN ('accepted','hired')
      )
    ) THEN
      RAISE EXCEPTION 'Not authorized: target user is not a hired worker on this job';
    END IF;
    v_is_payout := true;
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_user_id;

  IF v_is_payout OR (v_role = 'service_role' AND p_job_id IS NOT NULL) THEN
    UPDATE public.profiles
    SET
      jobs_completed = COALESCE(jobs_completed, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + p_amount
    WHERE id = p_user_id;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
  VALUES (p_user_id, p_amount, 'credit', p_description, p_job_id);
END;
$function$;
