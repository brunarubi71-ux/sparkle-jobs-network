
-- 1. Drop wallet_transactions user INSERT
DROP POLICY IF EXISTS "Users can insert their own wallet transactions" ON public.wallet_transactions;

-- 2. Drop point_history user INSERT + create award_points RPC
DROP POLICY IF EXISTS "Users can insert their own point history" ON public.point_history;

CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id uuid,
  p_points integer,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing boolean;
  v_once_reasons text[] := ARRAY['profile_complete', 'first_job', 'first_review', 'first_photo', 'identity_verified', 'premium_signup'];
BEGIN
  -- Only award to self
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  IF p_points <= 0 THEN
    RETURN 0;
  END IF;

  -- Check once-per-user reasons
  IF p_reason = ANY(v_once_reasons) THEN
    SELECT EXISTS(
      SELECT 1 FROM public.point_history
      WHERE user_id = p_user_id AND reason = p_reason
    ) INTO v_existing;
    IF v_existing THEN
      RETURN 0;
    END IF;
  END IF;

  INSERT INTO public.point_history (user_id, points, reason)
  VALUES (p_user_id, p_points, p_reason);

  UPDATE public.profiles SET points = points + p_points WHERE id = p_user_id;

  RETURN p_points;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_points(uuid, integer, text) FROM anon;

-- 3. Drop subscriptions user INSERT and UPDATE
DROP POLICY IF EXISTS "Users can insert their subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their subscription" ON public.subscriptions;

-- 4. Drop notifications user INSERT
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;

-- 5. Fix disputes: restrict reported user updates to response column only
DROP POLICY IF EXISTS "Reported can respond to dispute" ON public.disputes;
CREATE POLICY "Reported can respond to dispute"
ON public.disputes FOR UPDATE TO authenticated
USING (auth.uid() = reported_id)
WITH CHECK (
  auth.uid() = reported_id
  AND status = (SELECT d.status FROM public.disputes d WHERE d.id = disputes.id)
  AND admin_notes IS NOT DISTINCT FROM (SELECT d.admin_notes FROM public.disputes d WHERE d.id = disputes.id)
  AND admin_decision IS NOT DISTINCT FROM (SELECT d.admin_decision FROM public.disputes d WHERE d.id = disputes.id)
  AND reporter_id = (SELECT d.reporter_id FROM public.disputes d WHERE d.id = disputes.id)
  AND reported_id = (SELECT d.reported_id FROM public.disputes d WHERE d.id = disputes.id)
  AND reason = (SELECT d.reason FROM public.disputes d WHERE d.id = disputes.id)
  AND reporter_type = (SELECT d.reporter_type FROM public.disputes d WHERE d.id = disputes.id)
  AND job_id = (SELECT d.job_id FROM public.disputes d WHERE d.id = disputes.id)
);

-- 6. Create job_private_details table for sensitive fields
CREATE TABLE IF NOT EXISTS public.job_private_details (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  door_code text,
  lockbox_code text,
  gate_code text,
  alarm_instructions text,
  supply_code text,
  door_access_info text,
  parking_instructions text,
  owner_instructions text,
  payment_intent_id text
);

ALTER TABLE public.job_private_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Job participants can view private details"
ON public.job_private_details FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_private_details.job_id
    AND (j.owner_id = auth.uid() OR j.hired_cleaner_id = auth.uid())
  )
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Job owners can insert private details"
ON public.job_private_details FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_private_details.job_id
    AND j.owner_id = auth.uid()
  )
);

CREATE POLICY "Job owners can update private details"
ON public.job_private_details FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_private_details.job_id
    AND j.owner_id = auth.uid()
  )
);

CREATE POLICY "Service role manages private details"
ON public.job_private_details FOR ALL TO public
USING (auth.role() = 'service_role'::text);

-- Migrate existing sensitive data from jobs to job_private_details
INSERT INTO public.job_private_details (job_id, door_code, lockbox_code, gate_code, alarm_instructions, supply_code, door_access_info, parking_instructions, owner_instructions, payment_intent_id)
SELECT id, door_code, lockbox_code, gate_code, alarm_instructions, supply_code, door_access_info, parking_instructions, owner_instructions, payment_intent_id
FROM public.jobs
WHERE door_code IS NOT NULL OR lockbox_code IS NOT NULL OR gate_code IS NOT NULL 
  OR alarm_instructions IS NOT NULL OR supply_code IS NOT NULL OR door_access_info IS NOT NULL
  OR parking_instructions IS NOT NULL OR owner_instructions IS NOT NULL OR payment_intent_id IS NOT NULL
ON CONFLICT (job_id) DO NOTHING;

-- Now null out sensitive fields from jobs table (they live in job_private_details now)
UPDATE public.jobs SET
  door_code = NULL,
  lockbox_code = NULL,
  gate_code = NULL,
  alarm_instructions = NULL,
  supply_code = NULL,
  door_access_info = NULL,
  parking_instructions = NULL,
  owner_instructions = NULL,
  payment_intent_id = NULL;

-- 7. Schedules: create function to get contact details (owner-only)
CREATE OR REPLACE FUNCTION public.get_schedule_contact(p_schedule_id uuid)
RETURNS TABLE(contact_name text, phone text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.contact_name, s.phone, s.email
  FROM public.schedules s
  WHERE s.id = p_schedule_id
    AND s.owner_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_schedule_contact(uuid) FROM anon;

-- 8. Record wallet transaction RPC (for platform fee recording from client)
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
  -- Only the job owner can record fees on their own account
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the caller is the owner of the job
  IF NOT EXISTS (
    SELECT 1 FROM public.jobs WHERE id = p_job_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
  VALUES (p_owner_id, p_amount, 'platform_fee', p_description, p_job_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_platform_fee(uuid, numeric, text, uuid) FROM anon;
