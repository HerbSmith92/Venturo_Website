-- Named listing / event / community / guide opens from the member app.

create table if not exists public.app_item_days (
  day date not null,
  kind text not null check (kind in ('listing', 'event', 'community', 'guide')),
  item_id uuid not null,
  opens integer not null default 0 check (opens >= 0),
  visitors integer not null default 0 check (visitors >= 0),
  primary key (day, kind, item_id)
);

create table if not exists public.app_item_uniques (
  day date not null,
  kind text not null check (kind in ('listing', 'event', 'community', 'guide')),
  item_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (day, kind, item_id, user_id)
);

create index if not exists app_item_days_day_idx
  on public.app_item_days (day, kind, opens desc);

alter table public.app_item_days enable row level security;
alter table public.app_item_uniques enable row level security;

revoke all on table public.app_item_days from anon, authenticated;
revoke all on table public.app_item_uniques from anon, authenticated;

grant select on table public.app_item_days to authenticated;

create policy "Staff can read app item days"
  on public.app_item_days
  for select
  to authenticated
  using (public.is_staff());

create policy "No client access to item uniques"
  on public.app_item_uniques
  for all
  to authenticated
  using (false)
  with check (false);
