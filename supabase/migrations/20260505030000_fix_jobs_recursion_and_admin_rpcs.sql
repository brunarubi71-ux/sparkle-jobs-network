-- Fix 1: Infinite recursion in jobs SELECT policy.
-- The policy added by security_hardening_v2 queries job_applications,
-- which has its own RLS policy that queries jobs → infinite loop.
-- Solution: wrap the job_applications check in a SECURITY DEFINER
-- function so it bypasses RLS when called from within the policy.

CREATE OR REPLACE FUNCTION public._caller_is_job_applicant(p_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_applications
    WHERE job_id = p_job_id
      AND cleaner_id = auth.uid()
      AND status IN ('accepted', 'hired')
  );
$$;

DROP POLICY IF EXISTS "Stakeholders can view full job rows" ON public.jobs;
CREATE POLICY "Stakeholders can view full job rows"
ON public.jobs FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR hired_cleaner_id = auth.uid()
  OR public._caller_is_job_applicant(id)
  OR public.is_admin(auth.uid())
);

-- Fix 2: admin_adjust_wallet — credit or debit a user's wallet (admin only).
-- Returns the new wallet balance.
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  _user_id uuid,
  _amount  numeric,
  _reason  text
)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;
  IF _amount = 0 THEN
    RAISE EXCEPTION 'Amount must be non-zero';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + _amount
  WHERE id = _user_id
  RETURNING wallet_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description)
  VALUES (
    _user_id,
    abs(_amount),
    CASE WHEN _amount > 0 THEN 'credit' ELSE 'debit' END,
    COALESCE(_reason, 'Admin adjustment')
  );

  RETURN v_new_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) TO authenticated;

-- Fix 3: admin_override_subscription — change a user's plan/trial (admin only).
-- _action: 'extend_trial' | 'set_premium' | 'set_free'
-- _days: number of trial days from now (used with extend_trial)
CREATE OR REPLACE FUNCTION public.admin_override_subscription(
  _user_id uuid,
  _action  text,
  _days    integer DEFAULT NULL,
  _reason  text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;

  IF _action = 'extend_trial' THEN
    UPDATE public.profiles
    SET
      premium_status       = 'trial',
      is_premium           = true,
      free_trial_started_at = COALESCE(free_trial_started_at, now()),
      free_trial_ends_at    = now() + (COALESCE(_days, 7) || ' days')::interval
    WHERE id = _user_id;

  ELSIF _action = 'set_premium' THEN
    UPDATE public.profiles
    SET
      premium_status = 'active',
      is_premium     = true,
      plan_tier      = 'premium'
    WHERE id = _user_id;

  ELSIF _action = 'set_free' THEN
    UPDATE public.profiles
    SET
      premium_status       = 'free',
      is_premium           = false,
      plan_tier            = 'free',
      free_trial_ends_at   = NULL
    WHERE id = _user_id;

  ELSE
    RAISE EXCEPTION 'Invalid action: % (expected extend_trial/set_premium/set_free)', _action;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_override_subscription(uuid, text, integer, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_override_subscription(uuid, text, integer, text) TO authenticated;

-- Fix 4: admin_reset_violations — zero out a user's violation score (admin only).
-- Returns the number of violation_events rows deleted (0 if table doesn't exist).
CREATE OR REPLACE FUNCTION public.admin_reset_violations(
  _user_id uuid,
  _reason  text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;

  UPDATE public.profiles
  SET
    violation_score    = 0,
    visibility_penalty = 1.0
  WHERE id = _user_id;

  -- Delete violation events if the table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'violation_events'
  ) THEN
    DELETE FROM public.violation_events WHERE user_id = _user_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_violations(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_violations(uuid, text) TO authenticated;
