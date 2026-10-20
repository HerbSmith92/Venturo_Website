-- Permanent subscriber number. Assigned once, the first time membership turns on.
-- The app uses it for the profile ring: 1–150 gold, 151–500 silver,
-- 501–1500 bronze, 1501+ dull green. Numbers 1–25 also wear a gold crown.
-- Cancelling does not give the number away.

alter table public.member_access
  add column if not exists member_number integer,
  add column if not exists member_since timestamptz;

do $$
begin
  alter table public.member_access
    add constraint member_access_member_number_positive
    check (member_number is null or member_number > 0);
exception
  when duplicate_object then null;
end $$;

create unique index if not exists member_access_member_number_key
  on public.member_access (member_number);

create sequence if not exists private.member_number_seq;

-- Existing members, earliest subscription first. PayFast creation time when we have it.
with base as (
  select coalesce(max(member_number), 0) as floor
  from public.member_access
),
ranked as (
  select
    ma.user_id,
    base.floor + row_number() over (
      order by
        coalesce(
          (
            select min(m.created_at)
            from public.memberships m
            where m.user_id = ma.user_id
              and m.status in ('active', 'cancelled')
          ),
          ma.updated_at
        ),
        ma.user_id
    ) as n
  from public.member_access ma
  cross join base
  where ma.subscribed
    and ma.member_number is null
)
update public.member_access ma
set
  member_number = ranked.n,
  member_since = coalesce(ma.member_since, now())
from ranked
where ma.user_id = ranked.user_id;

select setval(
  'private.member_number_seq',
  greatest(coalesce((select max(member_number) from public.member_access), 1), 1),
  exists (select 1 from public.member_access where member_number is not null)
);

-- Runs after member_access_sync_subscribed, which sets subscribed from the payment flags.
create or replace function private.assign_member_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.member_number is not null then
    new.member_number := old.member_number;
    new.member_since := old.member_since;
  elsif new.subscribed is true and new.member_number is null then
    new.member_number := nextval('private.member_number_seq');
    new.member_since := coalesce(new.member_since, statement_timestamp());
  end if;
  return new;
end;
$$;

drop trigger if exists member_access_z_assign_number on public.member_access;
create trigger member_access_z_assign_number
before insert or update
on public.member_access
for each row
execute function private.assign_member_number();
