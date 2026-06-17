
-- Undo the overly-broad permissive policy and column grants from the previous migration
DROP POLICY IF EXISTS "Authenticated can read public profile fields" ON public.profiles;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;  -- RLS still enforces auth.uid()=id OR is_admin()

-- Rebuild the public profile view as SECURITY DEFINER (security_invoker=false),
-- so it bypasses RLS on profiles but only ever exposes the safe column set.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT
  id, full_name, avatar_url, bio, city, role, worker_type,
  identity_status, jobs_completed, is_premium, plan_tier,
  languages, specialties, has_transportation, transportation,
  experience_years, company_name, business_type, years_in_business,
  is_available_now, points, created_at
FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.public_profiles TO authenticated;
