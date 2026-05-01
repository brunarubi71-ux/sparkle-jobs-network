-- ===========================================================================
-- Security hardening (Lovable scan: 3 active errors)
--   1. Property access codes / payment data exposed via permissive jobs SELECT
--   2. Realtime channel topic exposure (gated by RLS once #1 is tightened)
--   3. Users can self-insert violations and reset their own violation_score
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- (1) Move sensitive columns off `jobs` into `job_private_details`
-- ---------------------------------------------------------------------------

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

-- Backfill from the existing jobs table (idempotent)
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

-- Drop the sensitive columns from jobs (also strips them from realtime payload)
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

-- Stakeholders: owner, hired cleaner, accepted applicant
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

CREATE POLICY "Service role manages job private details"
  ON public.job_private_details FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_job_private_details_job
  ON public.job_private_details(job_id);

CREATE TRIGGER trg_job_private_details_updated_at
  BEFORE UPDATE ON public.job_private_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- (2) Realtime — `jobs` row no longer carries access codes / payment_intent_id
--     after the column drop above, so the publication payload is sanitized.
--     RLS still gates per-row visibility (open jobs visible to all auth users
--     was intentional product behavior; only the sensitive columns moved).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- (3) platform_violations — block self-insert; expose a SECURITY DEFINER RPC
--     and a trigger that locks `profiles.violation_score`/`visibility_penalty`
--     against direct user updates.
-- ---------------------------------------------------------------------------

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

  -- Per-user rate limit: at most 50 violations recorded per hour
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

  -- Bypass the violation_score guard trigger for this transaction
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

-- Guard trigger: clients cannot mutate their own violation_score / visibility_penalty.
-- Service role and the SECURITY DEFINER RPC above bypass it via the session flag.
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
