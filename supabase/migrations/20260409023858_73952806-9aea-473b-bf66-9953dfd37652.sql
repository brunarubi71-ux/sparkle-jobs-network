
-- Add new columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS experience_years integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{English}',
  ADD COLUMN IF NOT EXISTS regions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS availability text DEFAULT 'full-time',
  ADD COLUMN IF NOT EXISTS transportation text DEFAULT 'car',
  ADD COLUMN IF NOT EXISTS supplies boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS years_in_business integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS jobs_completed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings numeric DEFAULT 0;

-- Add new columns to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS date_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleaner_earnings numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hired_cleaner_id uuid;

-- Create reviews table
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  reviewed_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Job participants can create reviews"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = reviews.job_id
      AND j.status = 'completed'
      AND (j.owner_id = auth.uid() OR j.hired_cleaner_id = auth.uid())
    )
  );

-- Create portfolio_photos table
CREATE TABLE public.portfolio_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  photo_url text NOT NULL,
  caption text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view portfolio photos"
  ON public.portfolio_photos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own photos"
  ON public.portfolio_photos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos"
  ON public.portfolio_photos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create rewards table
CREATE TABLE public.rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  badge_name text NOT NULL,
  earned_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view rewards"
  ON public.rewards FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can see their own rewards"
  ON public.rewards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('portfolio', 'portfolio', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for portfolio
CREATE POLICY "Portfolio images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio');

CREATE POLICY "Users can upload portfolio photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete portfolio photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Index for reviews lookups
CREATE INDEX idx_reviews_reviewed_id ON public.reviews(reviewed_id);
CREATE INDEX idx_reviews_job_id ON public.reviews(job_id);
CREATE INDEX idx_portfolio_user_id ON public.portfolio_photos(user_id);
CREATE INDEX idx_rewards_user_id ON public.rewards(user_id);
