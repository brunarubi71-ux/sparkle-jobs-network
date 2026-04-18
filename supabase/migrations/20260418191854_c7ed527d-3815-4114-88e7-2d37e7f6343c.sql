-- Add points column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

-- Create point_history table
CREATE TABLE IF NOT EXISTS public.point_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.point_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own point history"
ON public.point_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own point history"
ON public.point_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages point history"
ON public.point_history
FOR ALL
USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_point_history_user_id ON public.point_history(user_id);
CREATE INDEX IF NOT EXISTS idx_point_history_created_at ON public.point_history(created_at DESC);