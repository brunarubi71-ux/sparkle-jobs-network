-- Fix admin_reset_violations: must set app.violation_writer before UPDATE
-- so the protect_violation_columns trigger allows the change.
-- Note: private schema email/push URL fixes must be done manually via Supabase dashboard
-- since the private schema was not included in this project's migration history.

CREATE OR REPLACE FUNCTION public.admin_reset_violations(_user_id uuid, _reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_caller_role text;
  v_deleted     integer;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT role::text INTO v_caller_role FROM public.profiles WHERE id = v_caller;
  IF v_caller_role <> 'admin' THEN RAISE EXCEPTION 'Admin only'; END IF;

  WITH deleted AS (
    DELETE FROM public.platform_violations WHERE user_id = _user_id RETURNING id
  ) SELECT count(*) INTO v_deleted FROM deleted;

  PERFORM set_config('app.violation_writer', 'true', true);

  UPDATE public.profiles SET
    violation_score    = 0,
    visibility_penalty = 1.0,
    updated_at         = now()
  WHERE id = _user_id;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_violations(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_violations(uuid, text) TO authenticated;
