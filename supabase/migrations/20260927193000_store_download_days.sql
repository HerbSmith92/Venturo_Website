-- Daily iOS / Android download counts for Control Room Analytics.

create table if not exists public.store_download_days (
  platform text not null check (platform in ('ios', 'android')),
  day date not null,
  downloads integer not null default 0 check (downloads >= 0),
  primary key (platform, day)
);

create index if not exists store_download_days_day_idx
  on public.store_download_days (day desc);

alter table public.store_download_days enable row level security;

revoke all on table public.store_download_days from anon, authenticated;
grant select on table public.store_download_days to authenticated;

create policy "Staff can read store download days"
  on public.store_download_days
  for select
  to authenticated
  using (public.is_staff());
