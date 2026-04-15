-- Add risk scoring to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS violation_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visibility_penalty numeric NOT NULL DEFAULT 1.0;

-- Create violations tracking table
CREATE TABLE public.platform_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  violation_type text NOT NULL,
  context text NOT NULL DEFAULT 'chat',
  message_snippet text,
  auto_penalty_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own violations"
  ON public.platform_violations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert violations"
  ON public.platform_violations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages violations"
  ON public.platform_violations FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_violations_user ON public.platform_violations(user_id);
CREATE INDEX idx_violations_created ON public.platform_violations(created_at DESC);