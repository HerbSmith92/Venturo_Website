-- Member phones store an Apple device token or a Firebase token.
-- Expo tokens are cleared. They cannot be delivered without the Companion App.

alter table public.push_devices
  add column if not exists apns_environment text;

update public.push_devices
set token = null
where token is not null
  and token ~ '^(Exponent|Expo)PushToken\[';

update public.push_devices
set token = null
where token is not null
  and platform = 'ios'
  and token !~ '^[0-9a-fA-F]{64,200}$';

update public.push_devices
set token = lower(token)
where token is not null
  and platform = 'ios'
  and token ~ '^[0-9a-fA-F]{64,200}$';

update public.push_devices
set apns_environment = 'sandbox'
where platform = 'ios'
  and token is not null
  and apns_environment is null;

update public.push_devices
set token = null, apns_environment = null
where token is not null
  and platform = 'android'
  and (
    apns_environment is not null
    or char_length(token) < 20
    or char_length(token) > 4096
    or token ~ '[[:space:]]'
  );

alter table public.push_devices
  drop constraint if exists push_devices_token_shape;

alter table public.push_devices
  add constraint push_devices_token_shape check (
    token is null
    or (
      platform = 'ios'
      and token ~ '^[0-9a-f]{64,200}$'
      and apns_environment in ('sandbox', 'production')
    )
    or (
      platform = 'android'
      and apns_environment is null
      and char_length(token) between 20 and 4096
      and token !~ '[[:space:]]'
    )
  );

drop function if exists public.register_push_device(text, text, text, text);

create or replace function public.register_push_device(
  p_install_id text,
  p_platform text,
  p_app text,
  p_token text default null,
  p_apns_environment text default null
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
  v_env text := nullif(lower(btrim(coalesce(p_apns_environment, ''))), '');
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

  if p_platform = 'ios' then
    if v_token is not null then
      v_token := lower(v_token);
      if v_token !~ '^[0-9a-f]{64,200}$' then
        raise exception 'That is not an Apple push token';
      end if;
      if v_env is null then
        v_env := 'sandbox';
      end if;
      if v_env not in ('sandbox', 'production') then
        raise exception 'Apple push environment must be sandbox or production';
      end if;
    else
      v_env := null;
    end if;
  else
    v_env := null;
    if v_token is not null and (char_length(v_token) < 20 or char_length(v_token) > 4096 or v_token ~ '[[:space:]]') then
      raise exception 'That is not a Firebase push token';
    end if;
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

  insert into public.push_devices (user_id, install_id, token, platform, app, apns_environment)
  values (v_actor, v_install, v_token, p_platform, p_app, v_env)
  on conflict (app, install_id) do update
  set
    token = coalesce(excluded.token, public.push_devices.token),
    platform = excluded.platform,
    apns_environment = case
      when excluded.token is not null then excluded.apns_environment
      else public.push_devices.apns_environment
    end,
    updated_at = now();
end;
$$;

revoke all on function public.register_push_device(text, text, text, text, text) from public, anon;
grant execute on function public.register_push_device(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
