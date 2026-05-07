-- Fix: wallet_transactions type constraint was missing 'platform_fee'
-- Code in JobDetails.tsx records platform fees separately from worker payouts.
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
    CHECK (type IN ('credit', 'debit', 'platform_fee'));
