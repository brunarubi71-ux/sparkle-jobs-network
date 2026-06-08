-- Habilita pg_cron e pg_net para CRON jobs internos
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Função SQL que auto-aprova jobs em pending_review há mais de 24h
-- (equivalente à edge function auto-approve-jobs, sem precisar de CRON_SECRET)
CREATE OR REPLACE FUNCTION public.cron_auto_approve_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job      RECORD;
  v_dispute  uuid;
  v_approved integer := 0;
  v_cutoff   timestamptz := now() - interval '24 hours';
BEGIN
  FOR v_job IN
    SELECT id, hired_cleaner_id, price
    FROM public.jobs
    WHERE status = 'pending_review'
      AND pending_review_at < v_cutoff
  LOOP
    SELECT id INTO v_dispute
    FROM public.disputes
    WHERE job_id = v_job.id AND status = 'open'
    LIMIT 1;

    IF v_dispute IS NOT NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.jobs SET
      status                     = 'completed',
      owner_confirmed_completion = true,
      escrow_status              = 'released',
      updated_at                 = now()
    WHERE id = v_job.id;

    v_approved := v_approved + 1;
  END LOOP;

  RETURN v_approved;
END;
$$;

-- Roda a cada hora, chamada SQL direta (sem HTTP nem secret)
SELECT cron.schedule(
  'auto-approve-jobs-hourly',
  '0 * * * *',
  'SELECT public.cron_auto_approve_jobs()'
);
