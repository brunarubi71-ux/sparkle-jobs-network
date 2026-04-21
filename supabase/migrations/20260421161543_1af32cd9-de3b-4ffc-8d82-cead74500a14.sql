CREATE POLICY "Owners can delete their schedules"
ON public.schedules
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);