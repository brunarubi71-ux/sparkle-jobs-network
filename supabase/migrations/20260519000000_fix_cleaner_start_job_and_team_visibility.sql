-- Bug fix: cleaners/helpers cannot start or update their hired job because the
-- UPDATE policy on jobs only allows the owner. This caused the silent failure where
-- startJob() returned no error but updated 0 rows, triggering the success toast
-- without actually changing the status.
--
-- Also: accepted team members in job_applications couldn't see the job once it moved
-- past 'open'/'applied' status. Fixed via a SECURITY DEFINER helper function to
-- avoid the circular dependency (jobs SELECT → job_applications → jobs SELECT).

-- -----------------------------------------------------------------------
-- 1. Allow hired workers to update their own job
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Workers can update their hired job" ON public.jobs;

CREATE POLICY "Workers can update their hired job"
  ON public.jobs FOR UPDATE TO authenticated
  USING (
    hired_cleaner_id = auth.uid()
    OR hired_helper_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.job_applications
      WHERE job_id = public.jobs.id
        AND cleaner_id = auth.uid()
        AND status = 'accepted'
    )
  );

-- -----------------------------------------------------------------------
-- 2. Fix SELECT visibility for accepted team members
--    Uses SECURITY DEFINER to bypass the job_applications RLS and avoid
--    the circular dependency that previously caused HTTP 500 errors.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_accepted_job_ids()
  RETURNS SETOF uuid
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT job_id
  FROM public.job_applications
  WHERE cleaner_id = auth.uid()
    AND status = 'accepted';
$$;

REVOKE ALL ON FUNCTION public.my_accepted_job_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_accepted_job_ids() TO authenticated;

DROP POLICY IF EXISTS "Workers can view relevant jobs" ON public.jobs;

CREATE POLICY "Workers can view relevant jobs" ON public.jobs
  FOR SELECT TO authenticated
  USING (
    status IN ('open', 'applied')
    OR owner_id = auth.uid()
    OR hired_cleaner_id = auth.uid()
    OR hired_helper_id = auth.uid()
    OR id IN (SELECT public.my_accepted_job_ids())
  );
