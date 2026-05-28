-- =============================================================================
-- Security fix — resolve all Lovable scanner errors (recurring)
--
-- 1. ERROR: Job address visible to all authenticated users
--    → Move address from jobs → job_private_details (stakeholder-only access)
--
-- 2. ERROR: Schedule contact details visible to all authenticated users
--    → Drop permissive SELECT on schedules; owner-only direct access.
--      Non-owners already use get_schedules_with_access() SECURITY DEFINER RPC.
--
-- 3. ERROR: Realtime channel subscription unrestricted
--    → Enable Realtime RLS authorization (requires enabling via Supabase dashboard too)
--
-- 4. WARNING: Job owners cannot view cancellations on their own jobs
--    → Extend job_cancellations SELECT to include owner of the job
--
-- 5. WARNING: Hidden reviews visible to all authenticated users
--    → Filter is_hidden = true from public SELECT policy
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Move `address` from jobs to job_private_details
-- ---------------------------------------------------------------------------

-- a) Add address column to private table
ALTER TABLE public.job_private_details
  ADD COLUMN IF NOT EXISTS address text;

-- b) Migrate data: update rows that already exist
UPDATE public.job_private_details jpd
SET address = j.address
FROM public.jobs j
WHERE j.id = jpd.job_id
  AND j.address IS NOT NULL
  AND jpd.address IS NULL;

-- c) Insert rows for jobs that have an address but no private_details row yet
INSERT INTO public.job_private_details (job_id, address)
SELECT id, address
FROM public.jobs
WHERE address IS NOT NULL
  AND id NOT IN (SELECT job_id FROM public.job_private_details)
ON CONFLICT (job_id) DO UPDATE SET address = EXCLUDED.address;

-- d) Remove address from the publicly-accessible jobs table
ALTER TABLE public.jobs DROP COLUMN IF EXISTS address;

-- ---------------------------------------------------------------------------
-- 2. Restrict schedules SELECT — protect phone / email / contact_name
--    get_schedules_with_access() is SECURITY DEFINER so it bypasses RLS.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view schedules" ON public.schedules;

-- Owners can read their own complete records directly
CREATE POLICY "Owners can view own schedules"
  ON public.schedules FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Admins can view all schedules
CREATE POLICY "Admins can view all schedules"
  ON public.schedules FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Realtime authorization — restrict channel access via RLS
--    Supabase evaluates realtime.messages policies when
--    REALTIME_SUBSCRIPTION_AUTH is enabled (set in dashboard).
--    This migration adds the policy so it's ready when the dashboard toggle
--    is turned on. Action needed: Dashboard → Realtime → enable "Channel Auth".
-- ---------------------------------------------------------------------------

-- Grant realtime schema visibility (idempotent)
GRANT USAGE ON SCHEMA realtime TO authenticated;

-- Policy: a user may only subscribe to channels prefixed with their own user-id
-- OR to the well-known broadcast channels used by this app.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename  = 'messages'
      AND policyname = 'Users can subscribe to own channels'
  ) THEN
    ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can subscribe to own channels"
      ON realtime.messages FOR SELECT
      TO authenticated
      USING (
        -- channel names the app uses: bottomnav-{table}-{uid}, job-{id}, notifications-{uid}, etc.
        extension  = 'broadcast'
        AND (
          realtime.topic() LIKE '%' || auth.uid()::text || '%'
          OR realtime.topic() LIKE 'job-%'
        )
      );
  END IF;
EXCEPTION WHEN others THEN
  -- realtime.messages may not exist yet; skip gracefully
  NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Job cancellations — allow owners to see cancellations on their jobs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own cancellations" ON public.job_cancellations;

CREATE POLICY "Users can view relevant cancellations"
  ON public.job_cancellations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR job_id IN (
      SELECT id FROM public.jobs WHERE owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Reviews — hide rows where is_hidden = true from non-privileged users
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;

CREATE POLICY "Authenticated can view non-hidden reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (
    is_hidden IS NOT TRUE          -- regular users see only visible reviews
    OR reviewer_id  = auth.uid()   -- reviewer can see their own (even if hidden)
    OR reviewed_id  = auth.uid()   -- reviewed person sees reviews about them
    OR public.is_admin(auth.uid()) -- admins see everything
  );
