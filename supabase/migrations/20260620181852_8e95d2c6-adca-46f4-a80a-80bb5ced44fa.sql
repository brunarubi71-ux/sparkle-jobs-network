
-- Recreate public_profiles as a SECURITY INVOKER view (no definer bypass)
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  id, full_name, avatar_url, bio, city, role, worker_type, identity_status,
  jobs_completed, is_premium, plan_tier, languages, specialties,
  has_transportation, transportation, experience_years, company_name,
  business_type, years_in_business, is_available_now, points, created_at
FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- Allow authenticated users to read profile rows (needed for the invoker view)
DROP POLICY IF EXISTS "Authenticated can read public profile fields" ON public.profiles;
CREATE POLICY "Authenticated can read public profile fields"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Restrict column-level access on profiles so direct table reads only see safe fields
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, full_name, avatar_url, bio, city, role, worker_type, identity_status,
  jobs_completed, is_premium, plan_tier, languages, specialties,
  has_transportation, transportation, experience_years, company_name,
  business_type, years_in_business, is_available_now, points, created_at
) ON public.profiles TO authenticated;

-- Owners and admins keep full access via existing owner/admin SELECT policies,
-- but column grants apply at the SQL level. Re-grant full SELECT for service_role.
GRANT SELECT ON public.profiles TO service_role;
