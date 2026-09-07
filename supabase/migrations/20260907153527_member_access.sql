-- One row per member. PayFast & RevenueCat write flags; website & app read `subscribed`.
-- Do not store Paid on profiles.plan — members can update their own profile via RLS.

create table if not exists public.member_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  subscribed boolean not null default false,
  payfast_active boolean not null default false,
  revenuecat_active boolean not null default false,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists member_access_subscribed_idx
  on public.member_access (user_id)
  where subscribed = true;

alter table public.member_access enable row level security;

revoke all on table public.member_access from anon, authenticated;
grant select on table public.member_access to authenticated;

create policy "Members can read their own access"
  on public.member_access
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Staff can read member access"
  on public.member_access
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

-- subscribed = payfast_active OR revenuecat_active (service-role writers cannot skip this).
create or replace function private.sync_member_access_subscribed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.subscribed := coalesce(new.payfast_active, false)
    or coalesce(new.revenuecat_active, false);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists member_access_sync_subscribed on public.member_access;
create trigger member_access_sync_subscribed
before insert or update of payfast_active, revenuecat_active, subscribed
on public.member_access
for each row
execute function private.sync_member_access_subscribed();

create or replace function private.provision_member_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.member_access (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_provision_member_access on public.profiles;
create trigger profiles_provision_member_access
after insert on public.profiles
for each row
execute function private.provision_member_access();

-- Resolve RevenueCat app_user_id / aliases to auth.users (uuid or legacy WP id).
create or replace function private.resolve_auth_user_id(p_ids text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_raw text;
begin
  if p_ids is null then
    return null;
  end if;

  foreach v_raw in array p_ids loop
    if v_raw is null or btrim(v_raw) = '' then
      continue;
    end if;
    begin
      v_id := btrim(v_raw)::uuid;
      if exists (select 1 from auth.users where id = v_id) then
        return v_id;
      end if;
    exception
      when invalid_text_representation then
        v_id := null;
    end;
  end loop;

  foreach v_raw in array p_ids loop
    if v_raw is null or btrim(v_raw) = '' then
      continue;
    end if;
    select u.id into v_id
    from auth.users u
    where u.raw_app_meta_data ->> 'legacy_wp_user_id' = btrim(v_raw)
    limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end loop;

  return null;
end;
$$;

create or replace function public.resolve_auth_user_id(p_ids text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.resolve_auth_user_id(p_ids);
end;
$$;

revoke all on function public.resolve_auth_user_id(text[]) from public, anon, authenticated;
grant execute on function public.resolve_auth_user_id(text[]) to service_role;

insert into public.member_access (user_id)
select p.id
from public.profiles p
on conflict (user_id) do nothing;

update public.member_access as ma
set
  payfast_active = exists (
    select 1
    from public.memberships m
    where m.user_id = ma.user_id
      and m.status = 'active'
  ),
  current_period_end = (
    select m.current_period_end
    from public.memberships m
    where m.user_id = ma.user_id
      and m.status = 'active'
    order by m.current_period_end desc nulls last
    limit 1
  );

do $$
begin
  alter publication supabase_realtime add table public.member_access;
exception
  when duplicate_object then
    null;
  when undefined_object then
    null;
end;
$$;
