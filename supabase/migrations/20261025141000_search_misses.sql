-- Directory searches that returned nothing. Rows are kept so a signed-in
-- person can be contacted when that place is added. Anonymous searches
-- keep the term and have no contact.

create table if not exists public.search_misses (
  id uuid primary key default gen_random_uuid(),
  searched_at timestamptz not null default now(),
  day date not null,
  user_id uuid references auth.users (id) on delete set null,
  visitor_key uuid,
  platform text not null check (platform in ('web', 'ios', 'android', 'unknown')),
  query text not null default '',
  place text not null default '',
  category text not null default '',
  max_price text not null default '',
  near_me boolean not null default false,
  query_key text not null,
  created_at timestamptz not null default now()
);

comment on table public.search_misses is
  'Directory searches with no results. Kept. user_id is the person to contact. A closed account clears the link and leaves the search.';

create index if not exists search_misses_searched_at_idx
  on public.search_misses (searched_at desc);

create unique index if not exists search_misses_user_day_idx
  on public.search_misses (day, platform, user_id, query_key)
  where user_id is not null;

create unique index if not exists search_misses_visitor_day_idx
  on public.search_misses (day, platform, visitor_key, query_key)
  where user_id is null and visitor_key is not null;

alter table public.search_misses enable row level security;

drop policy if exists "Staff can read search misses" on public.search_misses;
create policy "Staff can read search misses"
  on public.search_misses
  for select
  to authenticated
  using (public.is_staff());

grant select on public.search_misses to authenticated;

create or replace function private.prevent_search_miss_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'search_misses rows are retained';
end;
$$;

drop trigger if exists search_misses_no_delete on public.search_misses;
create trigger search_misses_no_delete
before delete on public.search_misses
for each row
execute function private.prevent_search_miss_delete();

create or replace function public.search_miss_contacts(ids uuid[])
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = auth
as $$
  select u.id, u.email::text
  from auth.users u
  where u.id = any(ids);
$$;

revoke all on function public.search_miss_contacts(uuid[]) from public, anon, authenticated;
grant execute on function public.search_miss_contacts(uuid[]) to service_role;
