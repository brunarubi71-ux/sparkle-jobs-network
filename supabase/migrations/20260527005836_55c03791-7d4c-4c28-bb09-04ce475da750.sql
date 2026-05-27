
CREATE OR REPLACE FUNCTION public.unlock_schedule_contact(p_schedule_id uuid)
RETURNS TABLE(contact_name text, phone text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_limit int;
  v_used int;
  v_schedule public.schedules%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT * INTO v_schedule FROM public.schedules WHERE id = p_schedule_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found';
  END IF;

  -- Owner of the schedule can always see their own contact info
  IF v_schedule.owner_id = v_user THEN
    RETURN QUERY SELECT v_schedule.contact_name, v_schedule.phone, v_schedule.email;
    RETURN;
  END IF;

  -- Premium / pro-premium plans => unlimited
  IF COALESCE(v_profile.is_premium, false) = true
     OR v_profile.plan_tier IN ('premium','pro') THEN
    RETURN QUERY SELECT v_schedule.contact_name, v_schedule.phone, v_schedule.email;
    RETURN;
  END IF;

  -- Free tier: enforce limit (default 2 lifetime contact reveals for free users)
  v_limit := 2;
  v_used := COALESCE(v_profile.free_contacts_used, 0);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Contact unlock limit reached. Upgrade to premium for unlimited contacts.';
  END IF;

  UPDATE public.profiles
  SET free_contacts_used = COALESCE(free_contacts_used, 0) + 1
  WHERE id = v_user;

  RETURN QUERY SELECT v_schedule.contact_name, v_schedule.phone, v_schedule.email;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_schedule_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_schedule_contact(uuid) TO authenticated;
