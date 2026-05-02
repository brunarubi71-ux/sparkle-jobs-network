-- Atomic wallet debit/credit RPCs.
-- These replace the read-modify-write pattern on profiles.wallet_balance
-- in client code, which suffered from a classic race condition where two
-- concurrent operations could both observe the same balance and overwrite
-- each other.  All updates here happen in a single SQL statement and the
-- profile row is locked for the duration of the transaction.

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_amount numeric,
  p_description text,
  p_job_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_new_balance numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Atomic, race-free debit.  RETURNING gives us the post-update balance
  -- so we can react to "insufficient funds" without a separate SELECT.
  UPDATE public.profiles
  SET wallet_balance = ROUND(wallet_balance - p_amount, 2)
  WHERE id = v_user
    AND wallet_balance >= p_amount
  RETURNING wallet_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
  VALUES (v_user, p_amount, 'debit', p_description, p_job_id);

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.debit_wallet(numeric, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.debit_wallet(numeric, text, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_job_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_role text;
  v_new_balance numeric;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing target user';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Crediting another user is restricted to:
  --   * crediting yourself (e.g. a top-up reconciliation)
  --   * admins (manual adjustments)
  --   * the owner of the related job (paying out a worker on completion)
  IF p_user_id <> v_caller THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_caller;
    IF v_role <> 'admin' THEN
      IF p_job_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.jobs
        WHERE id = p_job_id AND owner_id = v_caller
      ) THEN
        RAISE EXCEPTION 'Not authorized to credit this user';
      END IF;
    END IF;
  END IF;

  UPDATE public.profiles
  SET wallet_balance = ROUND(COALESCE(wallet_balance, 0) + p_amount, 2)
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
  VALUES (p_user_id, p_amount, 'credit', p_description, p_job_id);

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_wallet(uuid, numeric, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, uuid) TO authenticated;
