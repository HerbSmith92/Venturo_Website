alter table public.events
  add column if not exists refund_intent text;

alter table public.events
  drop constraint if exists events_refund_intent_check;

alter table public.events
  add constraint events_refund_intent_check
  check (refund_intent is null or refund_intent in ('none', 'requested'));

create or replace function public.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (e.organiser_id = auth.uid() or public.is_staff())
  );
$$;

create or replace function public.host_postpone_event(
  p_event_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_refund_intent text default 'none'
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.events;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not public.can_manage_event(p_event_id) then raise exception 'not allowed'; end if;
  if p_ends_at < p_starts_at then raise exception 'End time must be after the start time.'; end if;

  update public.events
  set
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    refund_intent = case
      when p_refund_intent = 'requested' then 'requested'
      else coalesce(refund_intent, 'none')
    end,
    updated_at = now()
  where id = p_event_id
  returning * into row;

  if not found then raise exception 'event not found'; end if;

  insert into public.event_audit_events (event_id, actor_id, action, after)
  values (
    p_event_id,
    actor,
    'postpone',
    jsonb_build_object(
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'refund_intent', p_refund_intent
    )
  );

  return row;
end;
$$;

create or replace function public.host_cancel_event(
  p_event_id uuid,
  p_refund_intent text default 'none'
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.events;
  prev public.event_status;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not public.can_manage_event(p_event_id) then raise exception 'not allowed'; end if;

  select * into row from public.events where id = p_event_id for update;
  if not found then raise exception 'event not found'; end if;
  prev := row.status;

  update public.events
  set
    status = 'cancelled',
    refund_intent = case
      when p_refund_intent = 'requested' then 'requested'
      else coalesce(refund_intent, 'none')
    end,
    updated_at = now()
  where id = p_event_id
  returning * into row;

  insert into public.event_audit_events (event_id, actor_id, action, from_status, to_status, after)
  values (
    p_event_id,
    actor,
    'cancel',
    prev,
    'cancelled',
    jsonb_build_object('refund_intent', p_refund_intent)
  );

  return row;
end;
$$;

revoke all on function public.can_manage_event(uuid) from public;
grant execute on function public.can_manage_event(uuid) to authenticated, service_role;

revoke all on function public.host_postpone_event(uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.host_postpone_event(uuid, timestamptz, timestamptz, text) to authenticated, service_role;

revoke all on function public.host_cancel_event(uuid, text) from public;
grant execute on function public.host_cancel_event(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
