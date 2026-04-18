-- Add identity verification columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS identity_document_url text,
  ADD COLUMN IF NOT EXISTS identity_selfie_url text,
  ADD COLUMN IF NOT EXISTS identity_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_reviewed_at timestamptz;

-- Validate identity_status values via trigger (CHECK constraints can be limiting; trigger is flexible)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_identity_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_identity_status_check
      CHECK (identity_status IN ('unverified','pending','approved','rejected'));
  END IF;
END $$;

-- Helper: is_admin function (security definer to avoid recursion in RLS)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'admin'
  );
$$;

-- Allow admins to update any profile (for approving/rejecting identity)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Create private storage bucket for identity documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('identity-docs', 'identity-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for identity-docs
DROP POLICY IF EXISTS "Users can upload own identity docs" ON storage.objects;
CREATE POLICY "Users can upload own identity docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'identity-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can view own identity docs" ON storage.objects;
CREATE POLICY "Users can view own identity docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'identity-docs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update own identity docs" ON storage.objects;
CREATE POLICY "Users can update own identity docs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'identity-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own identity docs" ON storage.objects;
CREATE POLICY "Users can delete own identity docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'identity-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);