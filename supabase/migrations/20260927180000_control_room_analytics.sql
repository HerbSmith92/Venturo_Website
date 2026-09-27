-- Control Room analytics: public-site visits (first-party, no PII) & store download snapshots.

create table if not exists public.site_visit_days (
  day date primary key,
  pageviews integer not null default 0 check (pageviews >= 0),
  visitors integer not null default 0 check (visitors >= 0)
);

create table if not exists public.site_visit_uniques (
  day date not null,
  visitor_key text not null,
  primary key (day, visitor_key)
);

create table if not exists public.site_visit_presence (
  visitor_key text primary key,
  last_seen timestamptz not null default now()
);

create index if not exists site_visit_presence_last_seen_idx
  on public.site_visit_presence (last_seen desc);

create table if not exists public.app_download_snapshots (
  id uuid primary key default gen_random_uuid(),
  ios_downloads integer not null default 0 check (ios_downloads >= 0),
  android_downloads integer not null default 0 check (android_downloads >= 0),
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index if not exists app_download_snapshots_recorded_at_idx
  on public.app_download_snapshots (recorded_at desc);

alter table public.site_visit_days enable row level security;
alter table public.site_visit_uniques enable row level security;
alter table public.site_visit_presence enable row level security;
alter table public.app_download_snapshots enable row level security;

revoke all on table public.site_visit_days from anon, authenticated;
revoke all on table public.site_visit_uniques from anon, authenticated;
revoke all on table public.site_visit_presence from anon, authenticated;
revoke all on table public.app_download_snapshots from anon, authenticated;

grant select on table public.site_visit_days to authenticated;
grant select on table public.site_visit_presence to authenticated;
grant select, insert on table public.app_download_snapshots to authenticated;

create policy "Staff can read site visit days"
  on public.site_visit_days
  for select
  to authenticated
  using (public.is_staff());

create policy "Staff can read site visit presence"
  on public.site_visit_presence
  for select
  to authenticated
  using (public.is_staff());

create policy "Staff can read download snapshots"
  on public.app_download_snapshots
  for select
  to authenticated
  using (public.is_staff());

create policy "Staff can record download snapshots"
  on public.app_download_snapshots
  for insert
  to authenticated
  with check (public.is_staff() and recorded_by = auth.uid());

-- Visitor keys stay service-role only. RLS on with no client grants.
create policy "No client access to visit uniques"
  on public.site_visit_uniques
  for all
  to authenticated
  using (false)
  with check (false);
