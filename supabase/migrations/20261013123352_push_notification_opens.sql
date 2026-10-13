-- Count a person once when they tap a notification or open it in the app.

alter table public.push_inbox
  add column if not exists opened_at timestamptz;

create index if not exists push_inbox_opened_idx
  on public.push_inbox (campaign_id)
  where opened_at is not null;

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
  set
    read_at = coalesce(read_at, now()),
    opened_at = coalesce(opened_at, now())
  where id = p_inbox_id
    and user_id = v_actor;
end;
$$;

revoke all on function public.mark_push_read(uuid) from public, anon;
grant execute on function public.mark_push_read(uuid) to authenticated;

create or replace function public.record_push_open(p_campaign_id uuid)
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
  if p_campaign_id is null then
    raise exception 'Campaign required';
  end if;

  update public.push_inbox
  set
    opened_at = coalesce(opened_at, now()),
    read_at = coalesce(read_at, now())
  where campaign_id = p_campaign_id
    and user_id = v_actor;
end;
$$;

revoke all on function public.record_push_open(uuid) from public, anon;
grant execute on function public.record_push_open(uuid) to authenticated;
