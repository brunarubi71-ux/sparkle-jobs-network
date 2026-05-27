
-- 1. Drop duplicated sensitive columns from jobs (they live in job_private_details)
ALTER TABLE public.jobs DROP COLUMN IF EXISTS door_access_info;
ALTER TABLE public.jobs DROP COLUMN IF EXISTS owner_instructions;
ALTER TABLE public.jobs DROP COLUMN IF EXISTS parking_instructions;

-- 2. Schedules: lock down direct SELECT, expose masked rows via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Anyone authenticated can view schedules" ON public.schedules;

CREATE POLICY "Owners and admins can view schedules"
ON public.schedules
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_schedules_with_access()
RETURNS TABLE (
  id uuid,
  owner_id uuid,
  city text,
  number_of_houses integer,
  frequency text,
  monthly_income_estimate numeric,
  asking_price numeric,
  description text,
  contact_name text,
  phone text,
  email text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.owner_id, s.city, s.number_of_houses, s.frequency,
    s.monthly_income_estimate, s.asking_price, s.description,
    CASE WHEN s.owner_id = auth.uid()
              OR COALESCE((SELECT is_premium FROM public.profiles WHERE id = auth.uid()), false) = true
              OR (SELECT plan_tier FROM public.profiles WHERE id = auth.uid()) IN ('premium','pro')
              OR public.is_admin(auth.uid())
         THEN s.contact_name ELSE NULL END,
    CASE WHEN s.owner_id = auth.uid()
              OR COALESCE((SELECT is_premium FROM public.profiles WHERE id = auth.uid()), false) = true
              OR (SELECT plan_tier FROM public.profiles WHERE id = auth.uid()) IN ('premium','pro')
              OR public.is_admin(auth.uid())
         THEN s.phone ELSE NULL END,
    CASE WHEN s.owner_id = auth.uid()
              OR COALESCE((SELECT is_premium FROM public.profiles WHERE id = auth.uid()), false) = true
              OR (SELECT plan_tier FROM public.profiles WHERE id = auth.uid()) IN ('premium','pro')
              OR public.is_admin(auth.uid())
         THEN s.email ELSE NULL END,
    s.created_at
  FROM public.schedules s
  WHERE auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_schedules_with_access() TO authenticated;

-- 3. Realtime: require authenticated session to subscribe to any topic
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 4. Job cancellations: owners can view cancellations on their jobs
DROP POLICY IF EXISTS "Users can view their cancellations" ON public.job_cancellations;
CREATE POLICY "Users can view their cancellations"
ON public.job_cancellations
FOR SELECT
TO authenticated
USING (
  auth.uid() = cancelled_by
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_cancellations.job_id AND j.owner_id = auth.uid())
  OR public.is_admin(auth.uid())
);

-- 5. Reviews: hide moderated reviews from unrelated users
DROP POLICY IF EXISTS "Anyone authenticated can view reviews" ON public.reviews;
CREATE POLICY "Authenticated users can view non-hidden reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (
  is_hidden = false
  OR reviewer_id = auth.uid()
  OR reviewed_id = auth.uid()
  OR public.is_admin(auth.uid())
);
