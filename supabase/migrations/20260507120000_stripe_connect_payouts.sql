-- Stripe Connect fields on profiles
alter table public.profiles
  add column if not exists stripe_connect_account_id  text,
  add column if not exists stripe_connect_onboarded   boolean not null default false;

-- Withdrawal requests audit table
create table if not exists public.withdrawal_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  status          text not null default 'pending'
                    check (status in ('pending','processing','paid','failed')),
  stripe_transfer_id  text,
  failure_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.withdrawal_requests enable row level security;

-- Cleaners can only see their own withdrawal requests
create policy "cleaners_select_own_withdrawals"
  on public.withdrawal_requests for select
  using (auth.uid() = user_id);

-- Only edge functions (service role) can insert/update
create policy "service_role_manage_withdrawals"
  on public.withdrawal_requests for all
  using (auth.role() = 'service_role');

-- Index for fast lookups by user
create index if not exists withdrawal_requests_user_id_idx
  on public.withdrawal_requests(user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists withdrawal_requests_updated_at on public.withdrawal_requests;
create trigger withdrawal_requests_updated_at
  before update on public.withdrawal_requests
  for each row execute procedure public.set_updated_at();
