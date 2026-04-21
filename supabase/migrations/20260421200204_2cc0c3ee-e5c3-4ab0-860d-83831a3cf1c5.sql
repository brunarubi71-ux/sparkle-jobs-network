CREATE OR REPLACE FUNCTION public.notify_application_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT title INTO v_job_title FROM public.jobs WHERE id = NEW.job_id;

    INSERT INTO public.notifications (user_id, title, message, type, related_id, link)
    VALUES (
      NEW.cleaner_id,
      'Application accepted',
      '🎉 Your application was accepted! Check your job details.',
      'application_accepted',
      NEW.job_id,
      '/job/' || NEW.job_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_application_accepted ON public.job_applications;

CREATE TRIGGER trg_notify_application_accepted
AFTER UPDATE ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_application_accepted();