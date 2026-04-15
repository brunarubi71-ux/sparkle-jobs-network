-- Create storage bucket for property photos
INSERT INTO storage.buckets (id, name, public) VALUES ('property-photos', 'property-photos', true)
  ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view property photos (public bucket)
CREATE POLICY "Property photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-photos');

-- Allow authenticated users to upload property photos
CREATE POLICY "Authenticated users can upload property photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property-photos');

-- Allow users to delete their own property photos
CREATE POLICY "Users can delete their own property photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);