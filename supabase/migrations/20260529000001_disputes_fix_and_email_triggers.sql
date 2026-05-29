-- ============================================================
-- 0. Private schema for internal helper functions
-- ============================================================

CREATE SCHEMA IF NOT EXISTS private;
-- Only superuser/postgres can use private functions
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- ============================================================
-- 1. Fix disputes table: add columns used by the frontend
-- ============================================================

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS raised_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "against"  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS resolution  text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Back-fill existing rows from the original columns so nothing breaks
UPDATE public.disputes
SET
  raised_by  = reporter_id,
  "against"  = reported_id
WHERE raised_by IS NULL;

-- Allow admins to view and update all disputes
DROP POLICY IF EXISTS "Admins can manage disputes" ON public.disputes;
CREATE POLICY "Admins can manage disputes"
  ON public.disputes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- 2. admin_resolve_dispute RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  _dispute_id uuid,
  _decision    text,    -- 'refund_owner' | 'pay_cleaner' | 'dismiss'
  _notes       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        text;
  v_dispute     record;
  v_job         record;
  v_resolution  text;
  v_cleaner_id  uuid;
  v_amount      numeric;
BEGIN
  -- Only admins may call this
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can resolve disputes';
  END IF;

  IF _decision NOT IN ('refund_owner', 'pay_cleaner', 'dismiss') THEN
    RAISE EXCEPTION 'Invalid decision. Use: refund_owner | pay_cleaner | dismiss';
  END IF;

  -- Load dispute
  SELECT * INTO v_dispute FROM public.disputes WHERE id = _dispute_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispute % not found', _dispute_id;
  END IF;
  IF v_dispute.status <> 'open' THEN
    RAISE EXCEPTION 'Dispute is already resolved';
  END IF;

  -- Load related job (may not exist if deleted)
  SELECT * INTO v_job FROM public.jobs WHERE id = v_dispute.job_id;

  -- Build resolution label
  v_resolution := CASE _decision
    WHEN 'refund_owner' THEN 'Refunded to owner'
    WHEN 'pay_cleaner'  THEN 'Payment released to cleaner'
    WHEN 'dismiss'      THEN 'Dismissed — no action taken'
  END;
  IF _notes IS NOT NULL AND trim(_notes) <> '' THEN
    v_resolution := v_resolution || '. Notes: ' || trim(_notes);
  END IF;

  -- ── Execute financial action ────────────────────────────────
  IF v_job.id IS NOT NULL THEN
    IF _decision = 'refund_owner' AND v_job.owner_id IS NOT NULL THEN
      v_amount := GREATEST(COALESCE(v_job.total_amount, v_job.price, 0), 0);
      IF v_amount > 0 THEN
        UPDATE public.profiles
          SET wallet_balance = ROUND(COALESCE(wallet_balance, 0) + v_amount, 2)
          WHERE id = v_job.owner_id;

        INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
          VALUES (v_job.owner_id, v_amount, 'credit', 'Dispute refund', v_job.id);
      END IF;
      UPDATE public.jobs
        SET status = 'refunded', escrow_status = 'refunded'
        WHERE id = v_job.id;

    ELSIF _decision = 'pay_cleaner' THEN
      v_cleaner_id := COALESCE(
        v_dispute."against",
        v_dispute.reported_id,
        v_job.hired_cleaner_id
      );
      v_amount := GREATEST(COALESCE(v_job.cleaner_earnings, v_job.price, 0), 0);
      IF v_cleaner_id IS NOT NULL AND v_amount > 0 THEN
        UPDATE public.profiles
          SET wallet_balance = ROUND(COALESCE(wallet_balance, 0) + v_amount, 2)
          WHERE id = v_cleaner_id;

        INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
          VALUES (v_cleaner_id, v_amount, 'credit', 'Dispute resolved — payment released', v_job.id);
      END IF;
      UPDATE public.jobs
        SET status = 'completed', escrow_status = 'released'
        WHERE id = v_job.id;

    ELSIF _decision = 'dismiss' THEN
      UPDATE public.jobs
        SET escrow_status = NULL
        WHERE id = v_job.id AND escrow_status = 'disputed';
    END IF;
  END IF;

  -- ── Mark dispute resolved ───────────────────────────────────
  UPDATE public.disputes
  SET
    status      = 'resolved',
    resolution  = v_resolution,
    resolved_at = now(),
    resolved_by = auth.uid()
  WHERE id = _dispute_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, text) TO authenticated;

-- ============================================================
-- 3. Email notification triggers via pg_net
-- ============================================================

-- Enable pg_net (already available in all Supabase hosted projects)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Helper: retrieve the project's service_role key from Vault
-- Returns NULL if Vault is unavailable (emails skip silently, not error)
CREATE OR REPLACE FUNCTION private.get_service_role_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, vault, public
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role'
  LIMIT 1;
  RETURN v_key;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.get_service_role_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_service_role_key() TO postgres, service_role;

-- Helper: async HTTP POST to the send-email Edge Function
CREATE OR REPLACE FUNCTION private.enqueue_email(
  p_to       text,
  p_template text,
  p_data     jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, vault, public
AS $$
DECLARE
  v_key text;
  v_url text := 'https://upwzxjjeiuphlqsyztvm.supabase.co/functions/v1/send-email';
BEGIN
  IF p_to IS NULL OR trim(p_to) = '' THEN RETURN; END IF;

  v_key := private.get_service_role_key();
  IF v_key IS NULL THEN RETURN; END IF;

  -- net.http_post is fire-and-forget (async HTTP via pg_net)
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'to',       p_to,
      'template', p_template,
      'data',     p_data
    )::text
  );
EXCEPTION WHEN OTHERS THEN
  -- Email failures must never break the main transaction
  NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.enqueue_email(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.enqueue_email(text, text, jsonb) TO postgres, service_role;

-- ── 3a. Welcome email on new profile ─────────────────────────

CREATE OR REPLACE FUNCTION private.on_new_profile_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, vault, public
AS $$
BEGIN
  IF NEW.role NOT IN ('cleaner', 'owner') THEN RETURN NEW; END IF;
  IF NEW.email IS NULL OR trim(NEW.email) = '' THEN RETURN NEW; END IF;

  PERFORM private.enqueue_email(
    NEW.email,
    'welcome',
    jsonb_build_object('name', COALESCE(NEW.full_name, 'there'))
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.on_new_profile_welcome_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.on_new_profile_welcome_email() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_welcome_email ON public.profiles;
CREATE TRIGGER trg_welcome_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.on_new_profile_welcome_email();

-- ── 3b. New-message email notification ───────────────────────

CREATE OR REPLACE FUNCTION private.on_new_message_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, vault, public
AS $$
DECLARE
  v_conv       record;
  v_sender     record;
  v_recipient  record;
  v_recip_id   uuid;
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_recip_id := CASE
    WHEN NEW.sender_id = v_conv.cleaner_id THEN v_conv.owner_id
    ELSE v_conv.cleaner_id
  END;

  SELECT full_name, email INTO v_sender    FROM public.profiles WHERE id = NEW.sender_id;
  SELECT full_name, email INTO v_recipient FROM public.profiles WHERE id = v_recip_id;

  IF v_recipient.email IS NULL THEN RETURN NEW; END IF;

  PERFORM private.enqueue_email(
    v_recipient.email,
    'new_message',
    jsonb_build_object(
      'recipientName', COALESCE(v_recipient.full_name, 'there'),
      'senderName',    COALESCE(v_sender.full_name, 'Someone'),
      'preview',       left(COALESCE(NEW.content, ''), 200)
    )
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.on_new_message_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.on_new_message_email() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_new_message_email ON public.messages;
CREATE TRIGGER trg_new_message_email
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION private.on_new_message_email();

-- ── 3c. Dispute opened — notify reporter ─────────────────────

CREATE OR REPLACE FUNCTION private.on_dispute_opened_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, vault, public
AS $$
DECLARE
  v_job_title text;
  v_reporter  record;
BEGIN
  SELECT title INTO v_job_title FROM public.jobs WHERE id = NEW.job_id;
  SELECT full_name, email INTO v_reporter
  FROM public.profiles
  WHERE id = COALESCE(NEW.raised_by, NEW.reporter_id);

  IF v_reporter.email IS NOT NULL THEN
    PERFORM private.enqueue_email(
      v_reporter.email,
      'dispute_opened',
      jsonb_build_object(
        'userName', COALESCE(v_reporter.full_name, 'there'),
        'jobTitle', COALESCE(v_job_title, 'Cleaning Job'),
        'isAdmin',  false
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.on_dispute_opened_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.on_dispute_opened_email() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_dispute_opened_email ON public.disputes;
CREATE TRIGGER trg_dispute_opened_email
  AFTER INSERT ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION private.on_dispute_opened_email();

-- ── 3d. Identity verification result ─────────────────────────

CREATE OR REPLACE FUNCTION private.on_identity_status_change_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, vault, public
AS $$
BEGIN
  IF OLD.identity_status IS NOT DISTINCT FROM NEW.identity_status THEN RETURN NEW; END IF;
  IF NEW.identity_status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;
  IF NEW.email IS NULL THEN RETURN NEW; END IF;

  PERFORM private.enqueue_email(
    NEW.email,
    CASE NEW.identity_status
      WHEN 'approved' THEN 'identity_approved'
      ELSE 'identity_rejected'
    END,
    jsonb_build_object('name', COALESCE(NEW.full_name, 'there'))
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.on_identity_status_change_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.on_identity_status_change_email() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_identity_status_email ON public.profiles;
CREATE TRIGGER trg_identity_status_email
  AFTER UPDATE OF identity_status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.on_identity_status_change_email();

-- ── 3e. Cleaner hired / accepted notification ─────────────────

CREATE OR REPLACE FUNCTION private.on_job_application_hired_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, vault, public
AS $$
DECLARE
  v_cleaner  record;
  v_job_title text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('hired', 'accepted') THEN RETURN NEW; END IF;

  SELECT full_name, email INTO v_cleaner   FROM public.profiles WHERE id = NEW.cleaner_id;
  SELECT title             INTO v_job_title FROM public.jobs      WHERE id = NEW.job_id;

  IF v_cleaner.email IS NOT NULL THEN
    PERFORM private.enqueue_email(
      v_cleaner.email,
      'job_hired',
      jsonb_build_object(
        'cleanerName', COALESCE(v_cleaner.full_name, 'there'),
        'jobTitle',    COALESCE(v_job_title, 'Cleaning Job')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.on_job_application_hired_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.on_job_application_hired_email() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_job_hired_email ON public.job_applications;
CREATE TRIGGER trg_job_hired_email
  AFTER UPDATE OF status ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION private.on_job_application_hired_email();
