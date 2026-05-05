-- Critical pre-launch security hardening.
-- Fixes vulnerabilities found in pre-launch audit:
--   1. credit_wallet/debit_wallet accepted arbitrary p_user_id (any user could
--      grant themselves money or drain another user's wallet)
--   2. record_platform_fee wrote type='platform_fee' which violates the
--      wallet_transactions.type CHECK constraint, so calls always failed
--   3. seed_sample_data still callable by any authenticated user

-- 1. credit_wallet: restrict so it can only be called by:
--    - service_role (edge functions / webhooks), OR
--    - the owner of the job that p_job_id refers to, when crediting an
--      accepted worker on that job (this is the JobDetails approve-payment
--      flow). p_job_id is REQUIRED for non-service callers.
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_job_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_role text := auth.role();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Service role / admin paths bypass the per-job authorization (webhooks,
  -- admin tools). Everyone else must be approving a job they own and paying
  -- out an accepted worker on it.
  IF v_role <> 'service_role' AND NOT public.is_admin(v_caller) THEN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_job_id IS NULL THEN
      RAISE EXCEPTION 'Not authorized: job context required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.jobs WHERE id = p_job_id AND owner_id = v_caller
    ) THEN
      RAISE EXCEPTION 'Not authorized: caller does not own job';
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
          AND status = 'accepted'
      )
    ) THEN
      RAISE EXCEPTION 'Not authorized: target user is not a hired worker on this job';
    END IF;
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
  VALUES (p_user_id, p_amount, 'credit', p_description, p_job_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, uuid) TO authenticated;

-- 2. debit_wallet: only allow self-debit (or service_role / admin).
CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_job_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_caller uuid := auth.uid();
  v_role text := auth.role();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF v_role <> 'service_role' AND NOT public.is_admin(v_caller) THEN
    IF v_caller IS NULL OR v_caller <> p_user_id THEN
      RAISE EXCEPTION 'Not authorized: can only debit your own wallet';
    END IF;
  END IF;

  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
  VALUES (p_user_id, p_amount, 'debit', p_description, p_job_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.debit_wallet(uuid, numeric, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.debit_wallet(uuid, numeric, text, uuid) TO authenticated;

-- 3. record_platform_fee: previous version inserted type='platform_fee' which
--    violates the wallet_transactions.type CHECK (only 'credit'|'debit' allowed).
--    Use 'debit' since the fee is deducted from the owner's perspective.
CREATE OR REPLACE FUNCTION public.record_platform_fee(
  p_owner_id uuid,
  p_amount numeric,
  p_description text,
  p_job_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs WHERE id = p_job_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
  VALUES (p_owner_id, p_amount, 'debit', p_description, p_job_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_platform_fee(uuid, numeric, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_platform_fee(uuid, numeric, text, uuid) TO authenticated;

-- 4. seed_sample_data: revoke from authenticated. The signup flow no longer
--    calls it; nothing else should either.
REVOKE EXECUTE ON FUNCTION public.seed_sample_data(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_sample_data(uuid) FROM PUBLIC;

-- 5. credit_wallet: also increment the worker's jobs_completed and
--    total_earnings counters (the client used to UPDATE these directly,
--    which silently failed because the profiles UPDATE policy only allows
--    self-edit). Doing it inside the SECURITY DEFINER function fixes the
--    bug and keeps everything in one transaction.
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_job_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    IF p_job_id IS NULL THEN
      RAISE EXCEPTION 'Not authorized: job context required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.jobs WHERE id = p_job_id AND owner_id = v_caller
    ) THEN
      RAISE EXCEPTION 'Not authorized: caller does not own job';
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
          AND status = 'accepted'
      )
    ) THEN
      RAISE EXCEPTION 'Not authorized: target user is not a hired worker on this job';
    END IF;
    v_is_payout := true;
  END IF;

  -- Credit the wallet
  UPDATE public.profiles
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_user_id;

  -- For job payouts, also bump completion stats.
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
$$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, uuid) TO authenticated;

-- 6. public_profiles view: a safe-by-default projection of profiles that
--    excludes email/phone/wallet_balance/stripe_customer_id/violation_score
--    and other sensitive fields. The client should query this view (instead
--    of profiles directly) whenever it needs to display info about a user
--    other than the current user.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT
  id,
  full_name,
  avatar_url,
  bio,
  city,
  role,
  worker_type,
  has_transportation,
  jobs_completed,
  experience_years,
  specialties,
  languages,
  regions,
  availability,
  is_premium,
  premium_status,
  identity_status,
  points,
  business_type,
  years_in_business,
  company_name,
  language,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- 7. Tighten the underlying profiles SELECT policy: own row + admin only.
--    All client code that needs to display info about other users must now
--    go through public_profiles (or via a SECURITY DEFINER RPC).
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- 8. public_jobs view: a safe-by-default projection of jobs for browsing.
--    Excludes the precise street address, exact lat/long, and the financial
--    breakdown (platform_fee, total_amount, cleaner_earnings).  Distance
--    can still be computed using rounded coordinates (~1km granularity).
DROP VIEW IF EXISTS public.public_jobs;
CREATE VIEW public.public_jobs
WITH (security_invoker = false) AS
SELECT
  id,
  owner_id,
  title,
  cleaning_type,
  price,
  bedrooms,
  bathrooms,
  city,
  ROUND(latitude::numeric, 2)::double precision  AS latitude,
  ROUND(longitude::numeric, 2)::double precision AS longitude,
  urgency,
  status,
  description,
  main_property_photo,
  property_photos,
  team_size_required,
  cleaners_required,
  helpers_required,
  number_of_guests,
  guest_stay_length,
  allow_solo_start,
  hired_cleaner_id,
  escrow_status,
  pending_review_at,
  owner_confirmed_completion,
  completion_photos,
  completion_notes,
  date_time,
  created_at
FROM public.jobs;

GRANT SELECT ON public.public_jobs TO authenticated;
GRANT SELECT ON public.public_jobs TO anon;

-- 9. Tighten jobs SELECT policy: only stakeholders + admin can read the
--    full row (including precise address & financials). Browsers go through
--    public_jobs.
DROP POLICY IF EXISTS "Anyone authenticated can view open jobs" ON public.jobs;
DROP POLICY IF EXISTS "Stakeholders can view full job rows" ON public.jobs;

CREATE POLICY "Stakeholders can view full job rows"
ON public.jobs FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR hired_cleaner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.job_applications
    WHERE job_id = jobs.id
      AND cleaner_id = auth.uid()
      AND status IN ('accepted', 'hired')
  )
  OR public.is_admin(auth.uid())
);
