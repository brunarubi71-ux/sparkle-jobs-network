CREATE POLICY "Owners can delete their draft jobs"
ON public.jobs
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id AND status = 'draft');