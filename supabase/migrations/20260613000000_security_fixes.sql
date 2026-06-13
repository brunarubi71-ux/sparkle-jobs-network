-- Fix 1: notifications INSERT policy was too permissive (WITH CHECK (true) allowed
-- any authenticated user to insert notifications for any other user_id).
-- Restrict to only allow inserting notifications for oneself OR via service_role
-- (triggers and backend functions use service_role and bypass RLS).
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Fix 2: get_user_badges was granted to anon role, exposing badge history to
-- unauthenticated scrapers. Restrict to authenticated users only.
REVOKE EXECUTE ON FUNCTION public.get_user_badges(uuid) FROM anon;
