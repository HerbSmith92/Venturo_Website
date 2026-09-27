-- Cached App Store / Play Console / RevenueCat pulls for Control Room Analytics.

create table if not exists public.analytics_remote_cache (
  key text primary key,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'none',
  error text,
  fetched_at timestamptz not null default now()
);

alter table public.analytics_remote_cache enable row level security;

revoke all on table public.analytics_remote_cache from anon, authenticated;
grant select on table public.analytics_remote_cache to authenticated;

create policy "Staff can read analytics remote cache"
  on public.analytics_remote_cache
  for select
  to authenticated
  using (public.is_staff());
