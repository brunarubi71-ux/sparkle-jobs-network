-- =============================================================================
-- Apply to the OLD Supabase project (upwzxjjeiuphlqsyztvm)
-- =============================================================================
-- HOW TO USE:
--   1. Open https://supabase.com/dashboard/project/upwzxjjeiuphlqsyztvm/sql
--   2. Click "+ New query"
--   3. Paste the ENTIRE contents of this file
--   4. Click "Run" (Ctrl/Cmd+Enter)
--   5. Verify there are no errors
--
-- This file consolidates the 4 security migrations from this branch:
--   - 20260430120000_enforce_identity_verification_rls.sql
--   - 20260430120100_notification_rpc.sql
--   - 20260430120200_wallet_rpc.sql
--   - 20260501000000_security_hardening.sql
--
-- All statements are idempotent (use IF EXISTS / IF NOT EXISTS / CREATE OR
-- REPLACE), so re-running is safe.
--
-- AFTER RUNNING: delete this file from the repo, it's a one-shot helper.
-- =============================================================================


-- =============================================================================
-- PART 1 — Identity verification RLS (20260430120000)
-- =============================================================================

DROP POLICY IF EXISTS "Owners can insert jobs" ON public.jobs;

CREATE POLICY "Verified owners can insert jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.identity_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Cleaners can insert applications" ON public.job_applications;

CREATE POLICY "Verified cleaners can insert applications"
  ON public.job_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = cleaner_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.identity_status = 'approved'
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schedules'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Owners can insert schedules" ON public.schedules';
    EXECUTE $POLICY$
      CREATE POLICY "Verified users can insert schedules"
        ON public.schedules FOR INSERT
        TO authenticated
        WITH CHECK (
          auth.uid() = owner_id
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.identity_status = 'approved'
          )
        )
    $POLICY$;
  END IF;
END
$$;


-- =============================================================================
-- PART 2 — send_notification RPC (20260430120100)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_related_id uuid DEFAULT NULL,
  p_link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_role text;
  v_allowed boolean := false;
  v_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing target user';
  END IF;

  IF p_user_id = v_caller THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_caller;
    IF v_role = 'admin' THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed AND p_related_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = p_related_id
        AND (
          (j.owner_id = v_caller AND j.owner_id <> p_user_id) OR
          (j.owner_id = p_user_id AND v_caller IN (
            SELECT cleaner_id FROM public.job_applications
            WHERE job_id = j.id AND cleaner_id = v_caller
          ))
        )
    ) THEN
      v_allowed := true;
    END IF;

    IF NOT v_allowed AND EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.job_applications a ON a.job_id = j.id
      WHERE j.id = p_related_id
        AND j.owner_id = v_caller
        AND a.cleaner_id = p_user_id
    ) THEN
      v_allowed := true;
    END IF;

    IF NOT v_allowed AND EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.job_applications a ON a.job_id = j.id
      WHERE j.id = p_related_id
        AND j.owner_id = p_user_id
        AND a.cleaner_id = v_caller
    ) THEN
      v_allowed := true;
    END IF;

    IF NOT v_allowed AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = p_related_id
        AND ((c.owner_id = v_caller AND c.cleaner_id = p_user_id) OR
             (c.cleaner_id = v_caller AND c.owner_id = p_user_id))
    ) THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed AND EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.reviewer_id = v_caller
      AND r.reviewed_id = p_user_id
      AND r.created_at > now() - interval '5 minutes'
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to notify this user';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_id, link)
  VALUES (p_user_id, p_title, p_message, p_type, p_related_id, p_link)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_notification(uuid, text, text, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, uuid, text) TO authenticated;


-- =============================================================================
-- PART 3 — Atomic wallet RPCs (20260430120200)
-- =============================================================================

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


-- =============================================================================
-- PART 4 — Security hardening: private job details, violations (20260501000000)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_private_details (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  owner_instructions text,
  door_access_info text,
  door_code text,
  supply_code text,
  lockbox_code text,
  gate_code text,
  alarm_instructions text,
  parking_instructions text,
  payment_intent_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.job_private_details (
  job_id, owner_instructions, door_access_info, door_code, supply_code,
  lockbox_code, gate_code, alarm_instructions, parking_instructions,
  payment_intent_id
)
SELECT
  id, owner_instructions, door_access_info, door_code, supply_code,
  lockbox_code, gate_code, alarm_instructions, parking_instructions,
  payment_intent_id
FROM public.jobs
WHERE COALESCE(
  owner_instructions, door_access_info, door_code, supply_code,
  lockbox_code, gate_code, alarm_instructions, parking_instructions,
  payment_intent_id
) IS NOT NULL
ON CONFLICT (job_id) DO NOTHING;

ALTER TABLE public.jobs
  DROP COLUMN IF EXISTS owner_instructions,
  DROP COLUMN IF EXISTS door_access_info,
  DROP COLUMN IF EXISTS door_code,
  DROP COLUMN IF EXISTS supply_code,
  DROP COLUMN IF EXISTS lockbox_code,
  DROP COLUMN IF EXISTS gate_code,
  DROP COLUMN IF EXISTS alarm_instructions,
  DROP COLUMN IF EXISTS parking_instructions,
  DROP COLUMN IF EXISTS payment_intent_id;

ALTER TABLE public.job_private_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stakeholders can view job private details" ON public.job_private_details;
CREATE POLICY "Stakeholders can view job private details"
  ON public.job_private_details FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_private_details.job_id
        AND (
          j.owner_id = auth.uid()
          OR j.hired_cleaner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.job_applications ja
            WHERE ja.job_id = j.id
              AND ja.cleaner_id = auth.uid()
              AND ja.status = 'accepted'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Owners can insert job private details" ON public.job_private_details;
CREATE POLICY "Owners can insert job private details"
  ON public.job_private_details FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_private_details.job_id
        AND j.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update job private details" ON public.job_private_details;
CREATE POLICY "Owners can update job private details"
  ON public.job_private_details FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_private_details.job_id
        AND j.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages job private details" ON public.job_private_details;
CREATE POLICY "Service role manages job private details"
  ON public.job_private_details FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_job_private_details_job
  ON public.job_private_details(job_id);

DROP TRIGGER IF EXISTS trg_job_private_details_updated_at ON public.job_private_details;
CREATE TRIGGER trg_job_private_details_updated_at
  BEFORE UPDATE ON public.job_private_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Authenticated can insert violations" ON public.platform_violations;

CREATE OR REPLACE FUNCTION public.record_self_violation(
  _violation_type text,
  _context text,
  _message_snippet text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _recent_count int;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _violation_type IS NULL OR _violation_type = '' THEN
    RAISE EXCEPTION 'violation_type required';
  END IF;

  SELECT count(*) INTO _recent_count
    FROM public.platform_violations
    WHERE user_id = _uid
      AND created_at > now() - interval '1 hour';
  IF _recent_count >= 50 THEN
    RAISE EXCEPTION 'Violation rate limit exceeded';
  END IF;

  INSERT INTO public.platform_violations (
    user_id, violation_type, context, message_snippet, auto_penalty_applied
  ) VALUES (
    _uid,
    _violation_type,
    COALESCE(_context, 'chat'),
    CASE WHEN _message_snippet IS NULL THEN NULL
         ELSE substring(_message_snippet from 1 for 100)
    END,
    true
  )
  RETURNING id INTO _new_id;

  PERFORM set_config('app.violation_writer', 'true', true);

  UPDATE public.profiles
    SET violation_score   = COALESCE(violation_score, 0) + 1,
        visibility_penalty = CASE
          WHEN COALESCE(violation_score, 0) + 1 >= 10 THEN 0.2
          WHEN COALESCE(violation_score, 0) + 1 >= 5  THEN 0.5
          WHEN COALESCE(violation_score, 0) + 1 >= 3  THEN 0.8
          ELSE 1.0
        END
    WHERE id = _uid;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_self_violation(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_self_violation(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_violation_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.violation_writer', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.violation_score IS DISTINCT FROM OLD.violation_score THEN
    RAISE EXCEPTION 'violation_score is read-only for non-service callers';
  END IF;
  IF NEW.visibility_penalty IS DISTINCT FROM OLD.visibility_penalty THEN
    RAISE EXCEPTION 'visibility_penalty is read-only for non-service callers';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_violation_columns_trg ON public.profiles;
CREATE TRIGGER protect_violation_columns_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_violation_columns();


-- =============================================================================
-- DONE.
-- =============================================================================
