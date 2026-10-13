-- Control Room push campaigns, and the phones the Venturo apps register.
-- Companion registers app = 'companion'. The member app registers app = 'member'.

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  install_id text not null,
  token text,
  platform text not null check (platform in ('ios', 'android')),
  app text not null check (app in ('companion', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_install_key unique (app, install_id),
  constraint push_devices_install_uuid check (
    install_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint push_devices_token_shape check (
    token is null or token ~ '^(Exponent|Expo)PushToken\[.+\]$'
  )
);

create unique index push_devices_token_key
  on public.push_devices (token)
  where token is not null;

create index push_devices_user_id_idx
  on public.push_devices (user_id);

create index push_devices_app_user_idx
  on public.push_devices (app, user_id);

create table public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 240),
  audience text not null check (audience in ('everyone', 'paid', 'free', 'hosts')),
  app text not null check (app in ('companion', 'member', 'both')),
  link_path text,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  created_by uuid references auth.users (id) on delete set null,
  device_count int not null default 0 check (device_count >= 0),
  inbox_count int not null default 0 check (inbox_count >= 0),
  pushed_count int not null default 0 check (pushed_count >= 0),
  failed_count int not null default 0 check (failed_count >= 0),
  error text,
  created_at timestamptz not null default now(),
  constraint push_campaigns_link_path check (
    link_path is null
    or (
      char_length(link_path) <= 200
      and link_path ~ '^/[A-Za-z0-9][A-Za-z0-9/_-]{0,199}$'
      and link_path !~ '//'
      and position('..' in link_path) = 0
    )
  )
);

create index push_campaigns_created_at_idx
  on public.push_campaigns (created_at desc);

create table public.push_inbox (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.push_campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  link_path text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint push_inbox_campaign_user_key unique (campaign_id, user_id)
);

create index push_inbox_user_created_idx
  on public.push_inbox (user_id, created_at desc);

alter table public.push_devices enable row level security;
alter table public.push_campaigns enable row level security;
alter table public.push_inbox enable row level security;

revoke all on table public.push_devices from anon, authenticated;
revoke all on table public.push_campaigns from anon, authenticated;
revoke all on table public.push_inbox from anon, authenticated;

grant select on table public.push_devices to authenticated;
grant select on table public.push_campaigns to authenticated;
grant select on table public.push_inbox to authenticated;

create policy push_devices_select
  on public.push_devices
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_staff())
  );

create policy push_campaigns_staff_select
  on public.push_campaigns
  for select
  to authenticated
  using ((select public.is_staff()));

create policy push_inbox_select
  on public.push_inbox
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- The signed-in phone registers itself. Tokens are rebound if the same phone signs in as someone else.
create or replace function public.register_push_device(
  p_install_id text,
  p_platform text,
  p_app text,
  p_token text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_install text := lower(btrim(coalesce(p_install_id, '')));
  v_token text := nullif(btrim(coalesce(p_token, '')), '');
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_install !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Install id must be a uuid';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'Platform must be ios or android';
  end if;
  if p_app not in ('companion', 'member') then
    raise exception 'App must be companion or member';
  end if;
  if v_token is not null and v_token !~ '^(Exponent|Expo)PushToken\[.+\]$' then
    raise exception 'That is not an Expo push token';
  end if;
  if v_token is not null and char_length(v_token) > 200 then
    raise exception 'Push token is too long';
  end if;

  if v_token is not null then
    update public.push_devices
    set token = null, updated_at = now()
    where token = v_token
      and not (app = p_app and install_id = v_install);
  end if;

  delete from public.push_devices
  where app = p_app
    and install_id = v_install
    and user_id is distinct from v_actor;

  insert into public.push_devices (user_id, install_id, token, platform, app)
  values (v_actor, v_install, v_token, p_platform, p_app)
  on conflict (app, install_id) do update
  set
    token = coalesce(excluded.token, public.push_devices.token),
    platform = excluded.platform,
    updated_at = now();
end;
$$;

revoke all on function public.register_push_device(text, text, text, text) from public, anon;
grant execute on function public.register_push_device(text, text, text, text) to authenticated;

create or replace function public.mark_push_read(p_inbox_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;

  update public.push_inbox
  set read_at = coalesce(read_at, now())
  where id = p_inbox_id
    and user_id = v_actor;
end;
$$;

revoke all on function public.mark_push_read(uuid) from public, anon;
grant execute on function public.mark_push_read(uuid) to authenticated;

create or replace function public.unregister_push_device(
  p_install_id text,
  p_app text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_install text := lower(btrim(coalesce(p_install_id, '')));
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if p_app not in ('companion', 'member') then
    raise exception 'App must be companion or member';
  end if;

  delete from public.push_devices
  where user_id = v_actor
    and app = p_app
    and install_id = v_install;
end;
$$;

revoke all on function public.unregister_push_device(text, text) from public, anon;
grant execute on function public.unregister_push_device(text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.push_inbox;
exception
  when duplicate_object then
    null;
  when undefined_object then
    null;
end;
$$;
