-- send_notification RPC.
-- Allows the authenticated user to insert a notification for another user
-- only when there is a legitimate relationship (admin, shared job, review,
-- shared conversation, or self).  Runs SECURITY DEFINER so the strict RLS
-- on public.notifications is bypassed once the relationship check passes.

CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_related_id uuid DEFAULT NULL,
  p_link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_role text;
  v_allowed boolean := false;
  v_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing target user';
  END IF;

  -- Self-notify is always allowed.
  IF p_user_id = v_caller THEN
    v_allowed := true;
  END IF;

  -- Admins may notify anyone.
  IF NOT v_allowed THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_caller;
    IF v_role = 'admin' THEN
      v_allowed := true;
    END IF;
  END IF;

  -- Caller and target share a job (owner ↔ cleaner) on related_id, if provided.
  IF NOT v_allowed AND p_related_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = p_related_id
        AND (
          (j.owner_id = v_caller AND j.owner_id <> p_user_id) OR
          (j.owner_id = p_user_id AND v_caller IN (
            SELECT cleaner_id FROM public.job_applications
            WHERE job_id = j.id AND cleaner_id = v_caller
          ))
        )
    ) THEN
      v_allowed := true;
    END IF;

    -- Owner notifying any applicant on their job.
    IF NOT v_allowed AND EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.job_applications a ON a.job_id = j.id
      WHERE j.id = p_related_id
        AND j.owner_id = v_caller
        AND a.cleaner_id = p_user_id
    ) THEN
      v_allowed := true;
    END IF;

    -- Cleaner notifying the owner of a job they applied to.
    IF NOT v_allowed AND EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.job_applications a ON a.job_id = j.id
      WHERE j.id = p_related_id
        AND j.owner_id = p_user_id
        AND a.cleaner_id = v_caller
    ) THEN
      v_allowed := true;
    END IF;

    -- Caller and target are part of the same conversation referenced by related_id.
    IF NOT v_allowed AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = p_related_id
        AND ((c.owner_id = v_caller AND c.cleaner_id = p_user_id) OR
             (c.cleaner_id = v_caller AND c.owner_id = p_user_id))
    ) THEN
      v_allowed := true;
    END IF;
  END IF;

  -- Caller is reviewing the target (any recent review row with these participants).
  IF NOT v_allowed AND EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.reviewer_id = v_caller
      AND r.reviewed_id = p_user_id
      AND r.created_at > now() - interval '5 minutes'
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to notify this user';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_id, link)
  VALUES (p_user_id, p_title, p_message, p_type, p_related_id, p_link)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_notification(uuid, text, text, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, uuid, text) TO authenticated;
