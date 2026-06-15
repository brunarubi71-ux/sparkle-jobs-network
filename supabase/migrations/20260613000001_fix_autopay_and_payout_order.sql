-- Fix 1: cron_auto_approve_jobs was setting status='completed' but never
-- crediting worker wallets. Add a trigger on the jobs table that fires
-- whenever a job transitions to completed+released, and pays all workers.
-- Uses idempotency check on wallet_transactions so manual approval and
-- auto-approval cannot double-pay the same worker.

CREATE OR REPLACE FUNCTION public.trigger_pay_workers_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool            numeric;
  v_cleaner_count   integer;
  v_helper_count    integer;
  v_cleaner_share   numeric;
  v_helper_share    numeric;
  v_transport_total numeric;
  v_remainder       numeric;
  v_per_worker      numeric;
  v_share           numeric;
  v_wtype           text;
  v_worker_id       uuid;
BEGIN
  -- Only fire on transition to completed + escrow released
  IF NEW.status <> 'completed'
     OR OLD.status = 'completed'
     OR NEW.escrow_status <> 'released' THEN
    RETURN NEW;
  END IF;

  v_pool          := COALESCE(NEW.price, 0) * 0.9;
  v_cleaner_count := GREATEST(1, COALESCE(NEW.cleaners_required, 1));
  v_helper_count  := COALESCE(NEW.helpers_required, 0);

  -- Mirror getWorkerShare() from src/lib/earnings.ts
  IF v_helper_count = 0 OR v_cleaner_count = 0 THEN
    v_cleaner_share := v_pool / GREATEST(1, v_cleaner_count + v_helper_count);
    v_helper_share  := v_cleaner_share;
  ELSE
    v_transport_total := LEAST(20.0 * v_cleaner_count, v_pool * 0.5);
    v_remainder       := v_pool - v_transport_total;
    v_per_worker      := v_remainder / (v_cleaner_count + v_helper_count);
    v_cleaner_share   := (v_transport_total / v_cleaner_count) + v_per_worker;
    v_helper_share    := v_per_worker;
  END IF;

  -- Pay hired_cleaner_id (solo or team lead) if not already paid for this job
  IF NEW.hired_cleaner_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.wallet_transactions
       WHERE job_id = NEW.id
         AND user_id = NEW.hired_cleaner_id
         AND type = 'credit'
     ) THEN
    UPDATE public.profiles SET
      wallet_balance = wallet_balance + v_cleaner_share,
      jobs_completed = COALESCE(jobs_completed, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + v_cleaner_share
    WHERE id = NEW.hired_cleaner_id;

    INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
    VALUES (NEW.hired_cleaner_id, v_cleaner_share, 'credit',
            'Job payment: ' || COALESCE(NEW.title, NEW.id::text), NEW.id);
  END IF;

  -- Pay accepted team members from job_applications
  FOR v_worker_id, v_wtype IN
    SELECT ja.cleaner_id, COALESCE(p.worker_type, 'cleaner')
    FROM   public.job_applications ja
    JOIN   public.profiles p ON p.id = ja.cleaner_id
    WHERE  ja.job_id = NEW.id
      AND  ja.status IN ('accepted', 'hired')
      AND  ja.cleaner_id IS DISTINCT FROM NEW.hired_cleaner_id
      AND  NOT EXISTS (
             SELECT 1 FROM public.wallet_transactions
             WHERE job_id = NEW.id
               AND user_id = ja.cleaner_id
               AND type = 'credit'
           )
  LOOP
    v_share := CASE WHEN v_wtype = 'helper' THEN v_helper_share ELSE v_cleaner_share END;

    UPDATE public.profiles SET
      wallet_balance = wallet_balance + v_share,
      jobs_completed = COALESCE(jobs_completed, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + v_share
    WHERE id = v_worker_id;

    INSERT INTO public.wallet_transactions (user_id, amount, type, description, job_id)
    VALUES (v_worker_id, v_share, 'credit',
            'Job payment: ' || COALESCE(NEW.title, NEW.id::text), NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop old trigger if exists, then create fresh
DROP TRIGGER IF EXISTS pay_workers_on_completion ON public.jobs;

CREATE TRIGGER pay_workers_on_completion
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_pay_workers_on_completion();
