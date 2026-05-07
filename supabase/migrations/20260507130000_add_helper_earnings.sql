-- Add helper_earnings column that was referenced in the UI but missing from the schema.
-- This tracks earnings specifically from helper-role jobs separately from
-- general cleaner earnings so the Earnings page can display both accurately.
alter table public.profiles
  add column if not exists helper_earnings numeric(12,2) not null default 0;
