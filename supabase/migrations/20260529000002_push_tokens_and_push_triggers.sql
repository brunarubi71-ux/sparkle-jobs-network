-- ============================================================
-- Push notification tokens table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own tokens
CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role manages push tokens"
  ON public.push_tokens FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Push trigger: fire when a notification row is inserted
-- ============================================================

CREATE OR REPLACE FUNCTION private.on_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, vault, public
AS $$
DECLARE
  v_key text;
  v_url text := 'https://upwzxjjeiuphlqsyztvm.supabase.co/functions/v1/send-push-notification';
BEGIN
  v_key := private.get_service_role_key();
  IF v_key IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'userId',  NEW.user_id,
      'title',   NEW.title,
      'message', NEW.message,
      'data',    jsonb_build_object(
        'type',       COALESCE(NEW.type, 'general'),
        'related_id', COALESCE(NEW.related_id::text, ''),
        'link',       COALESCE(NEW.link, '')
      )
    )::text
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let push failure break the notification insert
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.on_notification_push() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.on_notification_push() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_notification_push ON public.notifications;
CREATE TRIGGER trg_notification_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION private.on_notification_push();
