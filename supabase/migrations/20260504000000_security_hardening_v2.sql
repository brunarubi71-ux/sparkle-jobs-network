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
