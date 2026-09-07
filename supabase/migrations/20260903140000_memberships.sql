-- PayFast recurring memberships (website). App Store / Play Store stay on RevenueCat.
-- Paid on the site = active row here OR RevenueCat entitlement.

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'cancelled', 'failed')),
  provider text not null default 'payfast'
    check (provider = 'payfast'),
  amount_cents integer not null,
  m_payment_id text not null unique,
  payfast_payment_id text,
  payfast_token text,
  current_period_end timestamptz,
  last_payment_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memberships_user_id_idx on public.memberships (user_id);
create index if not exists memberships_user_active_idx
  on public.memberships (user_id)
  where status = 'active';
create index if not exists memberships_payfast_token_idx
  on public.memberships (payfast_token)
  where payfast_token is not null;

alter table public.memberships enable row level security;

create policy "Members can read their own memberships"
  on public.memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- Inserts/updates for checkout & ITN use the service role (bypasses RLS).
