
-- Add completion_notes column to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completion_notes text;

-- Allow hired cleaners to update job status and completion data
CREATE POLICY "Hired cleaners can update their jobs"
ON public.jobs
FOR UPDATE
USING (auth.uid() = hired_cleaner_id)
WITH CHECK (auth.uid() = hired_cleaner_id);
