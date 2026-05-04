-- Add zip_code to jobs and update public_jobs view to expose it.
-- The PostJob form looks up city/state/lat/long from the ZIP/CEP.

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS zip_code text;

-- Recreate the public_jobs view to include zip_code (additive).
DROP VIEW IF EXISTS public.public_jobs;

CREATE VIEW public.public_jobs
WITH (security_invoker = false) AS
SELECT
  id,
  owner_id,
  title,
  cleaning_type,
  price,
  bedrooms,
  bathrooms,
  city,
  zip_code,
  ROUND(latitude::numeric, 2)::double precision  AS latitude,
  ROUND(longitude::numeric, 2)::double precision AS longitude,
  urgency,
  status,
  description,
  main_property_photo,
  property_photos,
  team_size_required,
  cleaners_required,
  helpers_required,
  number_of_guests,
  guest_stay_length,
  allow_solo_start,
  hired_cleaner_id,
  escrow_status,
  pending_review_at,
  owner_confirmed_completion,
  completion_photos,
  completion_notes,
  started_at,
  completed_at,
  accepted_at,
  applied_at,
  date_time,
  created_at
FROM public.jobs;

GRANT SELECT ON public.public_jobs TO authenticated;
GRANT SELECT ON public.public_jobs TO anon;
