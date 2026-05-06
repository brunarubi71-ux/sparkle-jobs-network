-- Adds the missing reviews moderation columns and the admin_moderate_review
-- RPC referenced by the admin dashboard. The PR description mentioned this
-- migration but it was never committed to the repo, so the admin "Hide /
-- Delete review" buttons throw "Could not find the function".

-- 1. Reviews moderation columns
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hidden_reason text;

-- 2. admin_moderate_review RPC: hide / unhide / delete a review (admin only)
CREATE OR REPLACE FUNCTION public.admin_moderate_review(
  _review_id uuid,
  _action text,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;

  IF _action = 'hide' THEN
    UPDATE public.reviews
    SET is_hidden = true,
        hidden_at = now(),
        hidden_by = v_caller,
        hidden_reason = _reason
    WHERE id = _review_id;
  ELSIF _action = 'unhide' THEN
    UPDATE public.reviews
    SET is_hidden = false,
        hidden_at = NULL,
        hidden_by = NULL,
        hidden_reason = NULL
    WHERE id = _review_id;
  ELSIF _action = 'delete' THEN
    DELETE FROM public.reviews WHERE id = _review_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: % (expected hide/unhide/delete)', _action;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_moderate_review(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_review(uuid, text, text) TO authenticated;
