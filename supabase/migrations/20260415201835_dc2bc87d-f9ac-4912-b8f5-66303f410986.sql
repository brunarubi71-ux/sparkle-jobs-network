-- Add escrow and auto-approval fields to jobs
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS pending_review_at timestamptz;

-- Create disputes table
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  reporter_id uuid NOT NULL,
  reported_id uuid NOT NULL,
  reporter_type text NOT NULL DEFAULT 'owner',
  reason text NOT NULL,
  response text,
  status text NOT NULL DEFAULT 'open',
  admin_decision text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Participants can view disputes on their jobs
CREATE POLICY "Participants can view disputes"
  ON public.disputes FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR auth.uid() = reported_id);

-- Reporter can create dispute
CREATE POLICY "Reporter can create dispute"
  ON public.disputes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Reported user can respond
CREATE POLICY "Reported can respond to dispute"
  ON public.disputes FOR UPDATE
  TO authenticated
  USING (auth.uid() = reported_id);

-- Service role full access for admin
CREATE POLICY "Service role manages disputes"
  ON public.disputes FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();