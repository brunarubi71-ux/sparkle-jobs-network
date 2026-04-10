
-- Add plan tier to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free';

-- Add team system columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_transportation boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS worker_type text NOT NULL DEFAULT 'cleaner';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_available_now boolean DEFAULT false;

-- Add team size to jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS team_size_required integer NOT NULL DEFAULT 1;

-- Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid NOT NULL,
  helper_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cleaner_id, helper_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cleaners can manage their team" ON public.team_members
  FOR ALL USING (auth.uid() = cleaner_id) WITH CHECK (auth.uid() = cleaner_id);

CREATE POLICY "Helpers can see teams they belong to" ON public.team_members
  FOR SELECT USING (auth.uid() = helper_id);

-- Create team_invites table for job-specific invitations
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  cleaner_id uuid NOT NULL,
  helper_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cleaners can create invites" ON public.team_invites
  FOR INSERT WITH CHECK (auth.uid() = cleaner_id);

CREATE POLICY "Participants can view invites" ON public.team_invites
  FOR SELECT USING (auth.uid() = cleaner_id OR auth.uid() = helper_id);

CREATE POLICY "Helpers can update invite status" ON public.team_invites
  FOR UPDATE USING (auth.uid() = helper_id);
