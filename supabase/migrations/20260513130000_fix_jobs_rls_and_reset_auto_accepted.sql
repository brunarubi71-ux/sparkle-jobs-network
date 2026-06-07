-- Fix jobs RLS policy: workers must be able to read jobs they applied to even after
-- the job status changes from 'open' to 'applied'. The old policy only allowed 'open',
-- which caused applied jobs to disappear from CleanerMyJobs ("Aplicadas" tab empty).
DROP POLICY IF EXISTS "Anyone can view open jobs" ON public.jobs;
DROP POLICY IF EXISTS "Workers can view relevant jobs" ON public.jobs;

CREATE POLICY "Workers can view relevant jobs" ON public.jobs
FOR SELECT TO authenticated
USING (
  status IN ('open', 'applied')
  OR owner_id = auth.uid()
  OR hired_cleaner_id = auth.uid()
  OR hired_helper_id = auth.uid()
  OR id IN (SELECT job_id FROM public.job_applications WHERE cleaner_id = auth.uid())
);

-- Reset applications that were auto-accepted by the old edge function logic.
-- All applications must start as 'pending' until the owner explicitly confirms them.
UPDATE public.job_applications
SET status = 'pending'
WHERE status = 'accepted'
  AND job_id IN (
    SELECT id FROM public.jobs
    WHERE status NOT IN ('in_progress', 'pending_review', 'completed', 'cancelled', 'hired')
  );

-- Clear auto-set hired_cleaner_id on jobs not yet formally hired by owner.
UPDATE public.jobs
SET hired_cleaner_id = NULL
WHERE hired_cleaner_id IS NOT NULL
  AND status IN ('open', 'applied')
  AND NOT EXISTS (
    SELECT 1 FROM public.job_applications
    WHERE job_id = public.jobs.id AND status = 'hired'
  );
