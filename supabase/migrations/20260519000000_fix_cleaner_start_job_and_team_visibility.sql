-- Bug fix: cleaners/helpers cannot start or update their hired job.
--
-- Root cause of HTTP 500 ("infinite recursion detected in policy for relation jobs"):
-- The original fix used EXISTS (SELECT FROM job_applications) directly in the
-- UPDATE USING clause. That triggered job_applications SELECT RLS, which reads
-- jobs.owner_id, which triggered jobs SELECT RLS again → infinite loop.
--
-- Solution: wrap the worker-check in a SECURITY DEFINER function so all internal
-- table accesses bypass RLS, cutting the recursive chain at the root.

-- -----------------------------------------------------------------------
-- 1. SECURITY DEFINER helper: checks if auth.uid() is a hired worker
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_hired_worker_for_job(p_job_id uuid)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE id = p_job_id
        AND (hired_cleaner_id = auth.uid() OR hired_helper_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.job_applications
      WHERE job_id = p_job_id
        AND cleaner_id = auth.uid()
        AND status IN ('accepted', 'hired')
    );
$$;

REVOKE ALL ON FUNCTION public.is_hired_worker_for_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_hired_worker_for_job(uuid) TO authenticated;

-- -----------------------------------------------------------------------
-- 2. UPDATE policy: use SECURITY DEFINER function (no raw RLS subquery)
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Workers can update their hired job" ON public.jobs;

CREATE POLICY "Workers can update their hired job"
  ON public.jobs FOR UPDATE TO authenticated
  USING (public.is_hired_worker_for_job(id));

-- -----------------------------------------------------------------------
-- 3. SELECT visibility for accepted/hired team members
--    Also uses SECURITY DEFINER to avoid the circular dependency.
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
    AND status IN ('accepted', 'hired');
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
