-- Fix the profiles_block_self_writes_to_protected_columns trigger so that
-- admin SECURITY DEFINER functions can update plan columns by setting app.plan_writer.
-- Also fix admin_override_subscription and add admin_activate_plan_for_all.

CREATE OR REPLACE FUNCTION profiles_block_self_writes_to_protected_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() IS NOT NULL AND auth.role() <> 'service_role' THEN
    IF NOT is_admin(auth.uid()) THEN
      NEW.role := OLD.role;
    END IF;

    -- Plan columns: protected unless an admin RPC sets app.plan_writer
    IF current_setting('app.plan_writer', true) <> 'true' THEN
      NEW.is_premium            := OLD.is_premium;
      NEW.premium_status        := OLD.premium_status;
      NEW.plan_tier             := OLD.plan_tier;
      NEW.free_trial_started_at := OLD.free_trial_started_at;
      NEW.free_trial_ends_at    := OLD.free_trial_ends_at;
    END IF;

    -- Always protected (no bypass)
    NEW.violation_score        := OLD.violation_score;
    NEW.visibility_penalty     := OLD.visibility_penalty;
    NEW.suspension_until       := OLD.suspension_until;
    NEW.jobs_completed         := OLD.jobs_completed;
    NEW.total_earnings         := OLD.total_earnings;
    NEW.helper_earnings        := OLD.helper_earnings;
    NEW.average_rating         := OLD.average_rating;
    NEW.total_reviews          := OLD.total_reviews;
    NEW.free_contacts_used     := OLD.free_contacts_used;
    NEW.jobs_used_today        := OLD.jobs_used_today;
    NEW.jobs_used_date         := OLD.jobs_used_date;
    NEW.stripe_customer_id     := OLD.stripe_customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_override_subscription(
  _user_id uuid,
  _action  text,
  _days    integer DEFAULT NULL,
  _reason  text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_caller_role text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT role::text INTO v_caller_role FROM public.profiles WHERE id = v_caller;
  IF v_caller_role <> 'admin' THEN RAISE EXCEPTION 'Admin only'; END IF;

  PERFORM set_config('app.plan_writer', 'true', true);

  IF _action = 'grant_pro' THEN
    UPDATE public.profiles SET plan_tier='pro', is_premium=true, premium_status='active', updated_at=now() WHERE id = _user_id;
  ELSIF _action = 'grant_premium' THEN
    UPDATE public.profiles SET plan_tier='premium', is_premium=true, premium_status='active', updated_at=now() WHERE id = _user_id;
  ELSIF _action = 'revoke' THEN
    UPDATE public.profiles SET plan_tier='free', is_premium=false, premium_status='free', updated_at=now() WHERE id = _user_id;
  ELSIF _action = 'extend_trial' THEN
    IF _days IS NULL OR _days <= 0 THEN RAISE EXCEPTION 'Days required and positive for extend_trial'; END IF;
    UPDATE public.profiles SET
      free_trial_started_at = COALESCE(free_trial_started_at, now()),
      free_trial_ends_at    = now() + make_interval(days => _days),
      premium_status        = 'trialing',
      is_premium            = true,
      updated_at            = now()
    WHERE id = _user_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_override_subscription(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_override_subscription(uuid, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_activate_plan_for_all(
  _plan   text,
  _reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_caller_role text;
  v_count       integer;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT role::text INTO v_caller_role FROM public.profiles WHERE id = v_caller;
  IF v_caller_role <> 'admin' THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF _plan NOT IN ('pro', 'premium') THEN RAISE EXCEPTION 'Invalid plan: %. Use pro or premium.', _plan; END IF;

  PERFORM set_config('app.plan_writer', 'true', true);

  UPDATE public.profiles SET
    plan_tier      = _plan,
    is_premium     = true,
    premium_status = 'active',
    updated_at     = now()
  WHERE role <> 'admin';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_activate_plan_for_all(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_activate_plan_for_all(text, text) TO authenticated;
