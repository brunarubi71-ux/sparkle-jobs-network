-- Allow users to set their OWN identity_status to 'pending' (submitting for review)
-- without being able to self-promote to 'verified' or 'rejected'.
-- The previous WITH CHECK forbade ANY change, blocking the verification flow.

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role               = (SELECT p.role               FROM public.profiles p WHERE p.id = auth.uid())
  AND is_premium         = (SELECT p.is_premium         FROM public.profiles p WHERE p.id = auth.uid())
  AND plan_tier          = (SELECT p.plan_tier          FROM public.profiles p WHERE p.id = auth.uid())
  AND violation_score    = (SELECT p.violation_score    FROM public.profiles p WHERE p.id = auth.uid())
  AND visibility_penalty = (SELECT p.visibility_penalty FROM public.profiles p WHERE p.id = auth.uid())
  AND wallet_balance     = (SELECT p.wallet_balance     FROM public.profiles p WHERE p.id = auth.uid())
  AND points             = (SELECT p.points             FROM public.profiles p WHERE p.id = auth.uid())
  AND jobs_used_today    = (SELECT p.jobs_used_today    FROM public.profiles p WHERE p.id = auth.uid())
  AND free_contacts_used = (SELECT p.free_contacts_used FROM public.profiles p WHERE p.id = auth.uid())
  -- identity_status: must stay the same OR transition to 'pending' (self-submit for review)
  AND (
    identity_status = (SELECT p.identity_status FROM public.profiles p WHERE p.id = auth.uid())
    OR identity_status = 'pending'
  )
);
