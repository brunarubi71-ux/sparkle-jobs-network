
-- 1) Move address + zip_code from jobs to job_private_details
ALTER TABLE public.job_private_details
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS zip_code text;

INSERT INTO public.job_private_details (job_id, address, zip_code)
SELECT j.id, j.address, j.zip_code
FROM public.jobs j
WHERE (j.address IS NOT NULL OR j.zip_code IS NOT NULL)
ON CONFLICT (job_id) DO UPDATE
  SET address = COALESCE(public.job_private_details.address, EXCLUDED.address),
      zip_code = COALESCE(public.job_private_details.zip_code, EXCLUDED.zip_code);

ALTER TABLE public.jobs DROP COLUMN IF EXISTS address;
ALTER TABLE public.jobs DROP COLUMN IF EXISTS zip_code;

-- 2) Update sensitive details RPC to include address + zip_code
DROP FUNCTION IF EXISTS public.get_job_sensitive_details(uuid);
CREATE OR REPLACE FUNCTION public.get_job_sensitive_details(p_job_id uuid)
RETURNS TABLE(
  door_code text, lockbox_code text, gate_code text, alarm_instructions text,
  supply_code text, door_access_info text, parking_instructions text,
  owner_instructions text, payment_intent_id text, address text, zip_code text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    p.door_code, p.lockbox_code, p.gate_code, p.alarm_instructions,
    p.supply_code, p.door_access_info, p.parking_instructions,
    p.owner_instructions, p.payment_intent_id, p.address, p.zip_code
  FROM public.jobs j
  LEFT JOIN public.job_private_details p ON p.job_id = j.id
  WHERE j.id = p_job_id
    AND (
      j.owner_id = auth.uid()
      OR j.hired_cleaner_id = auth.uid()
      OR public.is_admin(auth.uid())
    );
$$;

-- 3) Scope realtime.messages subscriptions
DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Scoped realtime subscriptions"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL AND (
      -- Per-user channels: name ends with -<uid>
      realtime.topic() LIKE '%-' || auth.uid()::text
      -- Per-conversation channels: messages-<conv-id> where user participates
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE 'messages-' || c.id::text = realtime.topic()
          AND (c.cleaner_id = auth.uid() OR c.owner_id = auth.uid())
      )
      -- Shared open channels safe for all authenticated users
      OR realtime.topic() IN ('new-jobs')
      -- Admin-only channel
      OR (realtime.topic() = 'admin-realtime' AND public.is_admin(auth.uid()))
    )
  );

-- 4) Restrict rewards SELECT to own rows + admin; add RPC for public badge view
DROP POLICY IF EXISTS "Anyone authenticated can view rewards" ON public.rewards;
CREATE POLICY "Users view their own rewards"
  ON public.rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_user_badges(p_user_id uuid)
RETURNS TABLE(id uuid, badge_name text, earned_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.badge_name, r.earned_at
  FROM public.rewards r
  WHERE r.user_id = p_user_id
  ORDER BY r.earned_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_badges(uuid) TO authenticated, anon;

-- 5) Explicitly block authenticated users from updating/deleting their own cancellations
CREATE POLICY "No user updates on cancellations"
  ON public.job_cancellations
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No user deletes on cancellations"
  ON public.job_cancellations
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);
