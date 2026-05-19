-- Fix: cast v_role to app_role enum explicitly — inserting plain text into
-- an enum column without cast causes "database error saving new user".
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role        text;
  v_worker_type text;
  v_has_transport boolean;
BEGIN
  v_role        := COALESCE(NEW.raw_user_meta_data->>'role', 'cleaner');
  v_worker_type := COALESCE(NEW.raw_user_meta_data->>'worker_type', 'cleaner');
  v_has_transport := COALESCE((NEW.raw_user_meta_data->>'has_transportation')::boolean, true);

  IF v_role NOT IN ('cleaner', 'owner') THEN
    v_role := 'cleaner';
  END IF;
  IF v_worker_type NOT IN ('cleaner', 'helper') THEN
    v_worker_type := 'cleaner';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, worker_type, has_transportation)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role::app_role,
    v_worker_type,
    v_has_transport
  );
  RETURN NEW;
END;
$$;
