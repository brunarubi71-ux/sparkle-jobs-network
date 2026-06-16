-- helper_pay: fixed amount the cleaner offers to each helper (replaces % split)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS helper_pay numeric(10,2);

-- referred_by: tracks which user referred this person to the app
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id);
