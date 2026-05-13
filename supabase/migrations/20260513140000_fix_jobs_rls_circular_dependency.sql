-- Remove the job_applications subquery from jobs RLS to break the circular dependency
-- that was causing HTTP 500 errors on all queries.
--
-- jobs RLS referenced job_applications → job_applications RLS referenced jobs → infinite recursion.
-- The subquery is not needed: status IN ('open','applied') already covers the Aplicadas tab,
-- and hired_cleaner_id / hired_helper_id cover the Ativas tab.
DROP POLICY IF EXISTS "Workers can view relevant jobs" ON public.jobs;

CREATE POLICY "Workers can view relevant jobs" ON public.jobs
FOR SELECT TO authenticated
USING (
  status IN ('open', 'applied')
  OR owner_id = auth.uid()
  OR hired_cleaner_id = auth.uid()
  OR hired_helper_id = auth.uid()
);
