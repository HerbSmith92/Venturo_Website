-- ensure_member_role used to insert onboarding_step = 'welcome', which is not
-- allowed by profiles_onboarding_step_check. Match provisionMember: 'identity'.

create or replace function public.ensure_member_role(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if auth.uid() is distinct from target and not public.is_staff() then
    raise exception 'not allowed';
  end if;

  select coalesce(raw_app_meta_data ->> 'role', '')
    into current_role
  from auth.users
  where id = target;

  if current_role = '' then
    update auth.users
    set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'member')
    where id = target;
  end if;

  insert into public.profiles (id, onboarding_step, onboarding_version)
  values (target, 'identity', 1)
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.ensure_member_role(uuid) from public;
grant execute on function public.ensure_member_role(uuid) to authenticated, service_role;
