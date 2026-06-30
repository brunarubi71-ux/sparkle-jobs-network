
-- 1) Profiles: drop the open SELECT policy that exposed sensitive fields to all authenticated users.
DROP POLICY IF EXISTS "Authenticated can read public profile fields" ON public.profiles;

-- Allow authenticated users to read the safe public_profiles view (already restricted to display fields).
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 2) Jobs: tighten "Stakeholders can view full job rows" so mere applicants don't read financial fields.
DROP POLICY IF EXISTS "Stakeholders can view full job rows" ON public.jobs;
CREATE POLICY "Stakeholders can view full job rows"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR hired_cleaner_id = auth.uid()
  OR public.is_admin(auth.uid())
);

-- 3) Storage avatars/portfolio: restrict insert/update/delete to authenticated role explicitly.
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload portfolio photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete portfolio photos" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload portfolio photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'portfolio' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete portfolio photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'portfolio' AND (auth.uid())::text = (storage.foldername(name))[1]);
