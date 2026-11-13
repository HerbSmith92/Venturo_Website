-- Per public-website path, and per member-app screen. Visitor keys stay off the client.

create table if not exists public.site_visit_page_days (
  day date not null,
  path text not null,
  pageviews integer not null default 0 check (pageviews >= 0),
  visitors integer not null default 0 check (visitors >= 0),
  dwell_seconds integer not null default 0 check (dwell_seconds >= 0),
  primary key (day, path)
);

create table if not exists public.site_visit_page_uniques (
  day date not null,
  path text not null,
  visitor_key text not null,
  primary key (day, path, visitor_key)
);

create table if not exists public.app_screen_days (
  day date not null,
  screen text not null,
  opens integer not null default 0 check (opens >= 0),
  visitors integer not null default 0 check (visitors >= 0),
  primary key (day, screen)
);

create table if not exists public.app_screen_uniques (
  day date not null,
  screen text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (day, screen, user_id)
);

create index if not exists site_visit_page_days_day_idx
  on public.site_visit_page_days (day, pageviews desc);

create index if not exists app_screen_days_day_idx
  on public.app_screen_days (day, opens desc);

alter table public.site_visit_page_days enable row level security;
alter table public.site_visit_page_uniques enable row level security;
alter table public.app_screen_days enable row level security;
alter table public.app_screen_uniques enable row level security;

revoke all on table public.site_visit_page_days from anon, authenticated;
revoke all on table public.site_visit_page_uniques from anon, authenticated;
revoke all on table public.app_screen_days from anon, authenticated;
revoke all on table public.app_screen_uniques from anon, authenticated;

grant select on table public.site_visit_page_days to authenticated;
grant select on table public.app_screen_days to authenticated;

create policy "Staff can read site visit pages"
  on public.site_visit_page_days
  for select
  to authenticated
  using (public.is_staff());

create policy "Staff can read app screen days"
  on public.app_screen_days
  for select
  to authenticated
  using (public.is_staff());

create policy "No client access to page uniques"
  on public.site_visit_page_uniques
  for all
  to authenticated
  using (false)
  with check (false);

create policy "No client access to screen uniques"
  on public.app_screen_uniques
  for all
  to authenticated
  using (false)
  with check (false);
