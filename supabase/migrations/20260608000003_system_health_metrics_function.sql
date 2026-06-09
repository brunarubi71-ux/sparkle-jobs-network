-- Função que retorna métricas de saúde do sistema para o painel admin
CREATE OR REPLACE FUNCTION public.admin_get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_caller_role text;
  v_db_size_mb  numeric;
  v_total_users bigint;
  v_total_jobs  bigint;
  v_total_msgs  bigint;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT role::text INTO v_caller_role FROM public.profiles WHERE id = v_caller;
  IF v_caller_role <> 'admin' THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT pg_database_size(current_database()) / 1024.0 / 1024.0 INTO v_db_size_mb;
  SELECT count(*) INTO v_total_users FROM public.profiles;
  SELECT count(*) INTO v_total_jobs  FROM public.jobs;
  SELECT count(*) INTO v_total_msgs  FROM public.messages;

  RETURN jsonb_build_object(
    'db_size_mb',     round(v_db_size_mb::numeric, 1),
    'db_limit_mb',    500,
    'db_pct',         round((v_db_size_mb / 500.0 * 100)::numeric, 1),
    'total_users',    v_total_users,
    'mau_limit',      50000,
    'mau_pct',        round((v_total_users::numeric / 50000.0 * 100)::numeric, 1),
    'total_jobs',     v_total_jobs,
    'total_messages', v_total_msgs,
    'plan',           'free',
    'upgrade_url',    'https://supabase.com/dashboard/project/vntnbjcwwgloprxsfpzc/settings/billing'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_system_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_system_health() TO authenticated;
