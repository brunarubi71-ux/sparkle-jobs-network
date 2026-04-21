-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new_job', 'job_accepted', 'new_message', 'new_application', 'job_completed')),
  read BOOLEAN NOT NULL DEFAULT false,
  related_id UUID,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role manages notifications"
  ON public.notifications FOR ALL
  USING (auth.role() = 'service_role');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============ TRIGGER FUNCTIONS ============

-- 1. New job posted → notify all cleaners/helpers in same city
CREATE OR REPLACE FUNCTION public.notify_new_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'open' AND NEW.city IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id, link)
    SELECT
      p.id,
      'New job in your area',
      NEW.title || ' • $' || NEW.price || ' • ' || NEW.city,
      'new_job',
      NEW.id,
      '/job/' || NEW.id::text
    FROM public.profiles p
    WHERE p.role = 'cleaner'
      AND p.city IS NOT NULL
      AND lower(p.city) = lower(NEW.city)
      AND p.id <> NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_job
AFTER INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_new_job();

-- 2. Job accepted (hired_cleaner_id set) → notify owner
CREATE OR REPLACE FUNCTION public.notify_job_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cleaner_name TEXT;
BEGIN
  -- Job accepted: hired_cleaner_id transitions from NULL to a value
  IF NEW.hired_cleaner_id IS NOT NULL AND (OLD.hired_cleaner_id IS NULL OR OLD.hired_cleaner_id <> NEW.hired_cleaner_id) THEN
    SELECT COALESCE(full_name, 'A cleaner') INTO v_cleaner_name
    FROM public.profiles WHERE id = NEW.hired_cleaner_id;

    INSERT INTO public.notifications (user_id, title, message, type, related_id, link)
    VALUES (
      NEW.owner_id,
      'Your job was accepted',
      v_cleaner_name || ' accepted "' || NEW.title || '"',
      'job_accepted',
      NEW.id,
      '/job/' || NEW.id::text
    );
  END IF;

  -- Job completed → notify owner
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id, link)
    VALUES (
      NEW.owner_id,
      'Job completed',
      '"' || NEW.title || '" was marked as completed',
      'job_completed',
      NEW.id,
      '/job/' || NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_job_status
AFTER UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_job_accepted();

-- 3. New message → notify other participant
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_cleaner_id UUID;
  v_recipient_id UUID;
  v_sender_name TEXT;
  v_snippet TEXT;
BEGIN
  SELECT owner_id, cleaner_id INTO v_owner_id, v_cleaner_id
  FROM public.conversations WHERE id = NEW.conversation_id;

  v_recipient_id := CASE WHEN NEW.sender_id = v_owner_id THEN v_cleaner_id ELSE v_owner_id END;

  IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Someone') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  v_snippet := CASE
    WHEN length(NEW.message_text) > 60 THEN substring(NEW.message_text from 1 for 60) || '…'
    ELSE NEW.message_text
  END;

  INSERT INTO public.notifications (user_id, title, message, type, related_id, link)
  VALUES (
    v_recipient_id,
    'New message from ' || v_sender_name,
    v_snippet,
    'new_message',
    NEW.conversation_id,
    '/chat/' || NEW.conversation_id::text
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- 4. New application → notify owner
CREATE OR REPLACE FUNCTION public.notify_new_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_job_title TEXT;
  v_cleaner_name TEXT;
BEGIN
  SELECT owner_id, title INTO v_owner_id, v_job_title
  FROM public.jobs WHERE id = NEW.job_id;

  IF v_owner_id IS NULL OR v_owner_id = NEW.cleaner_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'A cleaner') INTO v_cleaner_name
  FROM public.profiles WHERE id = NEW.cleaner_id;

  INSERT INTO public.notifications (user_id, title, message, type, related_id, link)
  VALUES (
    v_owner_id,
    'New application',
    v_cleaner_name || ' applied to "' || v_job_title || '"',
    'new_application',
    NEW.job_id,
    '/job/' || NEW.job_id::text
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_application
AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_new_application();