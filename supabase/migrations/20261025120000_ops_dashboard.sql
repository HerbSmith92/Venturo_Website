-- Control Room overview: thresholds, retained daily snapshots, signed-in
-- activity, and a membership payment ledger. Source rows are not deleted
-- when the dashboard is read. Snapshots and payment rows are append-only
-- so a later status change does not erase the day it happened.

create table if not exists public.ops_dashboard_settings (
  id int primary key default 1 check (id = 1),
  overdue_hours int not null default 48 check (overdue_hours >= 1 and overdue_hours <= 24 * 30),
  low_sales_percent numeric(5, 2) not null default 25 check (low_sales_percent >= 0 and low_sales_percent <= 100),
  low_sales_within_days int not null default 3 check (low_sales_within_days >= 1 and low_sales_within_days <= 30),
  membership_ending_days int not null default 7 check (membership_ending_days >= 1 and membership_ending_days <= 90),
  payout_due_days int not null default 7 check (payout_due_days >= 0 and payout_due_days <= 90),
  listing_check_days int not null default 180 check (listing_check_days >= 7 and listing_check_days <= 3650),
  ticket_email_grace_minutes int not null default 30 check (ticket_email_grace_minutes >= 5 and ticket_email_grace_minutes <= 24 * 60),
  activity_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ops_dashboard_settings (id)
values (1)
on conflict (id) do nothing;

comment on table public.ops_dashboard_settings is
  'Thresholds for the Control Room overview. Stock history lives in ops_metric_days.';

alter table public.ops_dashboard_settings enable row level security;

drop policy if exists "Staff can read ops dashboard settings" on public.ops_dashboard_settings;
create policy "Staff can read ops dashboard settings"
  on public.ops_dashboard_settings
  for select
  to authenticated
  using (public.is_staff());

drop policy if exists "Admins can update ops dashboard settings" on public.ops_dashboard_settings;
create policy "Admins can update ops dashboard settings"
  on public.ops_dashboard_settings
  for update
  to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

grant select, update on public.ops_dashboard_settings to authenticated;

-- One row per Johannesburg day, metric, and platform. Upserts replace the
-- same day only. Deletes are refused so the history stays available.
create table if not exists public.ops_metric_days (
  day date not null,
  metric_key text not null,
  platform text not null default 'all' check (platform in ('all', 'web', 'ios', 'android')),
  value numeric not null,
  recorded_at timestamptz not null default now(),
  primary key (day, metric_key, platform)
);

comment on table public.ops_metric_days is
  'Daily stock snapshots (paid members, live listings, and similar). Retained indefinitely.';

alter table public.ops_metric_days enable row level security;

drop policy if exists "Staff can read ops metric days" on public.ops_metric_days;
create policy "Staff can read ops metric days"
  on public.ops_metric_days
  for select
  to authenticated
  using (public.is_staff());

grant select on public.ops_metric_days to authenticated;

create or replace function private.prevent_ops_metric_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ops_metric_days rows are retained';
end;
$$;

drop trigger if exists ops_metric_days_no_delete on public.ops_metric_days;
create trigger ops_metric_days_no_delete
before delete on public.ops_metric_days
for each row
execute function private.prevent_ops_metric_delete();

-- Signed-in use. One row per user, Johannesburg day, platform, and kind.
-- Active users count scroll, view_listing, view_event, and view_community.
-- Combined totals count the user once. Anonymous visits stay in site_visit_days.
create table if not exists public.member_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  platform text not null check (platform in ('web', 'ios', 'android', 'unknown')),
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day, platform, kind)
);

create index if not exists member_activity_day_idx on public.member_activity (day, platform);
create index if not exists member_activity_day_kind_idx on public.member_activity (day, kind);

comment on table public.member_activity is
  'Signed-in use for Control Room active users. Active users are scroll, view_listing, view_event, and view_community. A user is stored once per day, platform, and kind.';

alter table public.member_activity enable row level security;

drop policy if exists "Staff can read member activity" on public.member_activity;
create policy "Staff can read member activity"
  on public.member_activity
  for select
  to authenticated
  using (public.is_staff());

grant select on public.member_activity to authenticated;

-- Website subscription charges. Renewals add a row; they do not overwrite
-- the previous charge. App Store and Play proceeds are not in this ledger.
create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid references public.memberships (id) on delete set null,
  user_id uuid,
  amount_cents int not null check (amount_cents >= 0),
  paid_at timestamptz not null,
  provider text not null check (provider in ('payfast', 'paystack')),
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create index if not exists membership_payments_paid_at_idx
  on public.membership_payments (paid_at);

comment on table public.membership_payments is
  'Each website membership charge. Gateway fees are not stored. Store billing stays in RevenueCat.';

alter table public.membership_payments enable row level security;

drop policy if exists "Staff can read membership payments" on public.membership_payments;
create policy "Staff can read membership payments"
  on public.membership_payments
  for select
  to authenticated
  using (public.is_staff());

grant select on public.membership_payments to authenticated;

create or replace function private.prevent_membership_payment_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'membership_payments rows are retained';
end;
$$;

drop trigger if exists membership_payments_no_delete on public.membership_payments;
create trigger membership_payments_no_delete
before delete on public.membership_payments
for each row
execute function private.prevent_membership_payment_delete();

insert into public.membership_payments (membership_id, user_id, amount_cents, paid_at, provider, external_id)
select
  m.id,
  m.user_id,
  m.amount_cents,
  coalesce(m.last_payment_at, m.created_at),
  m.provider,
  coalesce(m.paystack_transaction_id, m.payfast_payment_id, m.m_payment_id)
from public.memberships m
where m.status in ('active', 'cancelled')
  and (m.last_payment_at is not null or m.status = 'active')
on conflict (provider, external_id) do nothing;

-- Refunds keep the original paid_at. refunded_at is the refund day, so the
-- sale stays in its original period and the refund is counted in its own.
alter table public.event_orders
  add column if not exists refunded_at timestamptz;

update public.event_orders
set refunded_at = updated_at
where status = 'refunded'
  and refunded_at is null;

create or replace function private.stamp_order_refunded_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded' then
    new.refunded_at := coalesce(new.refunded_at, now());
  elsif old.status = 'refunded' and new.status is distinct from 'refunded' then
    new.refunded_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists event_orders_stamp_refunded_at on public.event_orders;
create trigger event_orders_stamp_refunded_at
before update of status on public.event_orders
for each row
execute function private.stamp_order_refunded_at();

create index if not exists event_orders_paid_at_idx on public.event_orders (paid_at);
create index if not exists event_orders_refunded_at_idx on public.event_orders (refunded_at);

-- Test and staff-marked accounts stay out of production business figures.
alter table public.profiles
  add column if not exists exclude_from_metrics boolean not null default false;

comment on column public.profiles.exclude_from_metrics is
  'When true, this account is left out of Control Room business totals. Emails matching test patterns are excluded as well.';

create index if not exists profiles_exclude_from_metrics_idx
  on public.profiles (id)
  where exclude_from_metrics;

-- Enquiries stay after they are handled.
alter table public.enquiries
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users (id) on delete set null;

drop policy if exists "Staff can update enquiries" on public.enquiries;
create policy "Staff can update enquiries"
  on public.enquiries
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant update on public.enquiries to authenticated;

create or replace function public.metrics_excluded_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id
  from public.profiles p
  where p.exclude_from_metrics
  union
  select u.id
  from auth.users u
  where coalesce(u.email, '') ilike '%+test@%'
     or coalesce(u.email, '') ilike 'test@%'
     or coalesce(u.email, '') ilike '%@example.com'
     or coalesce(u.email, '') ilike '%@example.org'
     or coalesce(u.raw_app_meta_data ->> 'exclude_from_metrics', '') = 'true';
$$;

revoke all on function public.metrics_excluded_user_ids() from public, anon, authenticated;
grant execute on function public.metrics_excluded_user_ids() to service_role;
