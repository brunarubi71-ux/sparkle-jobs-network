
-- 1. Drop unused SECURITY DEFINER views
DROP VIEW IF EXISTS public.public_jobs;
DROP VIEW IF EXISTS public.public_profiles;

-- 2. Set search_path on email queue helper functions
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;

-- 3. Rewards: only service role may insert badges
DROP POLICY IF EXISTS "Users can see their own rewards" ON public.rewards;
DROP POLICY IF EXISTS "Service role manages rewards" ON public.rewards;
CREATE POLICY "Service role manages rewards"
  ON public.rewards FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. job_cancellations: lock penalty fields on user insert
DROP POLICY IF EXISTS "Users can create cancellations" ON public.job_cancellations;
CREATE POLICY "Users can create cancellations"
  ON public.job_cancellations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = cancelled_by
    AND COALESCE(is_late_cancellation, false) = false
    AND COALESCE(penalty_applied, false) = false
  );

-- 5. Drop sensitive access-code columns from jobs (they belong in job_private_details)
ALTER TABLE public.job_private_details
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS owner_instructions text;

ALTER TABLE public.jobs
  DROP COLUMN IF EXISTS door_code CASCADE,
  DROP COLUMN IF EXISTS lockbox_code CASCADE,
  DROP COLUMN IF EXISTS gate_code CASCADE,
  DROP COLUMN IF EXISTS supply_code CASCADE,
  DROP COLUMN IF EXISTS alarm_instructions CASCADE,
  DROP COLUMN IF EXISTS payment_intent_id CASCADE;

-- 6. Recreate update policies (CASCADE above also dropped them) with locked financial fields
DROP POLICY IF EXISTS "Owners can update their jobs" ON public.jobs;
CREATE POLICY "Owners can update their jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND escrow_status     IS NOT DISTINCT FROM (SELECT j.escrow_status     FROM public.jobs j WHERE j.id = jobs.id)
    AND cleaner_earnings  IS NOT DISTINCT FROM (SELECT j.cleaner_earnings  FROM public.jobs j WHERE j.id = jobs.id)
    AND platform_fee      IS NOT DISTINCT FROM (SELECT j.platform_fee      FROM public.jobs j WHERE j.id = jobs.id)
    AND total_amount      IS NOT DISTINCT FROM (SELECT j.total_amount      FROM public.jobs j WHERE j.id = jobs.id)
    AND hired_cleaner_id  IS NOT DISTINCT FROM (SELECT j.hired_cleaner_id  FROM public.jobs j WHERE j.id = jobs.id)
  );

DROP POLICY IF EXISTS "Hired cleaners can update their jobs" ON public.jobs;
CREATE POLICY "Hired cleaners can update their jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = hired_cleaner_id)
  WITH CHECK (
    auth.uid() = hired_cleaner_id
    AND escrow_status     IS NOT DISTINCT FROM (SELECT j.escrow_status     FROM public.jobs j WHERE j.id = jobs.id)
    AND cleaner_earnings  IS NOT DISTINCT FROM (SELECT j.cleaner_earnings  FROM public.jobs j WHERE j.id = jobs.id)
    AND platform_fee      IS NOT DISTINCT FROM (SELECT j.platform_fee      FROM public.jobs j WHERE j.id = jobs.id)
    AND total_amount      IS NOT DISTINCT FROM (SELECT j.total_amount      FROM public.jobs j WHERE j.id = jobs.id)
    AND hired_cleaner_id  IS NOT DISTINCT FROM (SELECT j.hired_cleaner_id  FROM public.jobs j WHERE j.id = jobs.id)
    AND owner_id          IS NOT DISTINCT FROM (SELECT j.owner_id          FROM public.jobs j WHERE j.id = jobs.id)
    AND price             IS NOT DISTINCT FROM (SELECT j.price             FROM public.jobs j WHERE j.id = jobs.id)
  );

-- 7. Update get_job_sensitive_details to read from job_private_details only
CREATE OR REPLACE FUNCTION public.get_job_sensitive_details(p_job_id uuid)
 RETURNS TABLE(door_code text, lockbox_code text, gate_code text, alarm_instructions text, supply_code text, door_access_info text, parking_instructions text, owner_instructions text, payment_intent_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.door_code, p.lockbox_code, p.gate_code, p.alarm_instructions,
    p.supply_code, p.door_access_info, p.parking_instructions,
    p.owner_instructions, p.payment_intent_id
  FROM public.jobs j
  LEFT JOIN public.job_private_details p ON p.job_id = j.id
  WHERE j.id = p_job_id
    AND (
      j.owner_id = auth.uid()
      OR j.hired_cleaner_id = auth.uid()
      OR public.is_admin(auth.uid())
    );
$function$;
