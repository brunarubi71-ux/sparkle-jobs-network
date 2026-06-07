-- Reset corrupted weekly job counter for all users.
-- The accept-job edge function was incorrectly incrementing jobs_used_today
-- for pending applications (not yet confirmed). The weekly limit now uses
-- a live query against job_applications, so these columns are no longer used
-- for the paywall check. Reset them to avoid any residual blocks.
UPDATE public.profiles
SET jobs_used_today = 0,
    jobs_used_date  = NULL
WHERE jobs_used_today > 0;
