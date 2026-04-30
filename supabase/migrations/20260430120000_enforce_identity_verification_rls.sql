-- Pre-launch hardening: enforce identity verification at the DB level
-- so a malicious client cannot bypass UI checks by calling the API directly.
--
-- Rules:
--   * Owners may only INSERT new jobs if their profile is identity_status='approved'.
--   * Cleaners/Helpers may only INSERT job_applications if their profile is approved.
--   * Cleaners may only INSERT new schedules-for-sale if their profile is approved.
--   * Existing rows are never invalidated, so already-posted jobs stay accessible.

-- ---- jobs.INSERT ------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can insert jobs" ON public.jobs;

CREATE POLICY "Verified owners can insert jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.identity_status = 'approved'
    )
  );

-- ---- job_applications.INSERT -----------------------------------------------
DROP POLICY IF EXISTS "Cleaners can insert applications" ON public.job_applications;

CREATE POLICY "Verified cleaners can insert applications"
  ON public.job_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = cleaner_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.identity_status = 'approved'
    )
  );

-- ---- schedules.INSERT (sell-schedule listings) ------------------------------
-- Only apply if the table exists in this database; ignore otherwise.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schedules'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Owners can insert schedules" ON public.schedules';
    EXECUTE $POLICY$
      CREATE POLICY "Verified users can insert schedules"
        ON public.schedules FOR INSERT
        TO authenticated
        WITH CHECK (
          auth.uid() = owner_id
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.identity_status = 'approved'
          )
        )
    $POLICY$;
  END IF;
END
$$;
