
-- Add job execution fields
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS completion_photos text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS owner_instructions text,
ADD COLUMN IF NOT EXISTS door_access_info text,
ADD COLUMN IF NOT EXISTS property_photos text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS owner_confirmed_completion boolean DEFAULT false;

-- Add cancellation tracking to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS suspension_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancellation_violations integer DEFAULT 0;

-- Create cancellation tracking table
CREATE TABLE public.job_cancellations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL,
  cancelled_by uuid NOT NULL,
  reason text,
  is_late_cancellation boolean DEFAULT false,
  penalty_applied boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.job_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their cancellations" ON public.job_cancellations
FOR SELECT TO authenticated USING (auth.uid() = cancelled_by);

CREATE POLICY "Users can create cancellations" ON public.job_cancellations
FOR INSERT TO authenticated WITH CHECK (auth.uid() = cancelled_by);
