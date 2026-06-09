CREATE TABLE IF NOT EXISTS public.bug_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email  text,
  category    text NOT NULL DEFAULT 'bug' CHECK (category IN ('bug', 'payment', 'account', 'other')),
  description text NOT NULL,
  page_url    text,
  resolved    boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  admin_note  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "Users can insert bug reports"
  ON public.bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own reports
CREATE POLICY "Users can read own bug reports"
  ON public.bug_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read and update all reports (via service role used in edge functions / RLS bypass)
-- The admin dashboard uses the anon key with admin JWT, so we add a policy for role=admin
CREATE POLICY "Admins can manage bug reports"
  ON public.bug_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
