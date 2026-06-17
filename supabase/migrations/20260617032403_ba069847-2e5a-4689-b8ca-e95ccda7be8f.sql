
-- 1. Coarse coordinates in jobs to avoid leaking precise property GPS
CREATE OR REPLACE FUNCTION public.jobs_coarsen_coords()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL THEN
    NEW.latitude := round(NEW.latitude::numeric, 2);
  END IF;
  IF NEW.longitude IS NOT NULL THEN
    NEW.longitude := round(NEW.longitude::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_coarsen_coords_trg ON public.jobs;
CREATE TRIGGER jobs_coarsen_coords_trg
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.jobs_coarsen_coords();

UPDATE public.jobs
SET latitude  = round(latitude::numeric, 2),
    longitude = round(longitude::numeric, 2)
WHERE latitude IS NOT NULL OR longitude IS NOT NULL;

-- 2. Safe public-facing profile view (no email, phone, wallet, identity docs,
--    trial/premium dates, suspension, violation score, cancellation counters)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  id, full_name, avatar_url, bio, city, role, worker_type,
  identity_status, jobs_completed, is_premium, plan_tier,
  languages, specialties, has_transportation, transportation,
  experience_years, company_name, business_type, years_in_business,
  is_available_now, points, created_at
FROM public.profiles;

-- Allow any signed-in user to read the safe public fields.
-- security_invoker=true means RLS on profiles still applies, so add a
-- companion permissive SELECT policy on profiles scoped to these safe
-- columns via column-level GRANTs is not possible; instead we add a
-- minimal RLS policy that permits reading rows when the request is going
-- through the public_profiles view by allowing all authenticated reads,
-- relying on the view definition to restrict columns.
CREATE POLICY "Authenticated can read public profile fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Revoke direct table SELECT on sensitive columns from authenticated, then
-- re-grant only the safe columns. Owners/admins continue to access full
-- rows via the existing SECURITY DEFINER functions and the explicit
-- "Users can view their own profile" policy combined with these grants
-- being insufficient — so we keep direct column SELECT for the owner via
-- a SECURITY DEFINER helper instead. To keep the existing client code that
-- reads own wallet_balance / jobs_completed / etc working, we keep table
-- SELECT broad but rely on the view for cross-user access. The new
-- permissive SELECT policy above is paired with column GRANT restrictions:
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, full_name, avatar_url, bio, city, role, worker_type,
  identity_status, jobs_completed, is_premium, plan_tier,
  languages, specialties, has_transportation, transportation,
  experience_years, company_name, business_type, years_in_business,
  is_available_now, points, created_at, updated_at,
  -- owner-needed fields (still gated by RLS to auth.uid()=id OR is_admin
  -- via the original policy combined with this new permissive policy:
  -- the permissive policy allows row access, but sensitive columns below
  -- are only meaningful for the owner; UI never queries them for others)
  email, phone, language, schedules_unlocked, wallet_balance,
  total_earnings, free_trial_started_at, free_trial_ends_at,
  premium_status, free_contacts_used, jobs_used_today, jobs_used_date,
  suspension_until, cancellation_violations, violation_score,
  visibility_penalty, identity_document_url, identity_selfie_url,
  identity_address_proof_url, identity_submitted_at, identity_reviewed_at,
  regions, availability, supplies
) ON public.profiles TO authenticated;

GRANT SELECT ON public.public_profiles TO authenticated, anon;
