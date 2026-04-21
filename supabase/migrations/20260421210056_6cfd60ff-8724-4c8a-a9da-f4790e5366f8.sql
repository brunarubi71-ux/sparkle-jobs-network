ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS cleaners_required integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS helpers_required integer NOT NULL DEFAULT 0;

-- Backfill existing rows: assume 1 cleaner + (team_size - 1) helpers
UPDATE public.jobs
SET cleaners_required = 1,
    helpers_required = GREATEST(COALESCE(team_size_required, 1) - 1, 0)
WHERE cleaners_required IS NULL OR helpers_required IS NULL;

-- Add a check to ensure at least one worker is required
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_team_composition_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_team_composition_check
  CHECK ((cleaners_required + helpers_required) >= 1);