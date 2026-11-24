-- A member can remove one of their own inbox rows.

create or replace function public.delete_push_inbox(p_inbox_id uuid)
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
  if p_inbox_id is null then
    raise exception 'Missing notification';
  end if;

  delete from public.push_inbox
  where id = p_inbox_id
    and user_id = v_actor;
end;
$$;

revoke all on function public.delete_push_inbox(uuid) from public, anon;
grant execute on function public.delete_push_inbox(uuid) to authenticated;
