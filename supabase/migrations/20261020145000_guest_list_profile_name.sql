-- Guest Management called profiles.first_name. That column is not on profiles.
-- The given name lives in display_name, the surname in last_name.
-- The failed query was swallowed, so the host saw an empty guest list.

drop function if exists public.list_event_door_guests(uuid);

create function public.list_event_door_guests(p_event_id uuid)
returns table (
  ticket_id uuid,
  code text,
  ticket_type_name text,
  buyer_id uuid,
  guest_name text,
  guest_email text,
  guest_phone text,
  scanned_at timestamptz,
  scanned_by uuid,
  purchased_at timestamptz,
  is_scanned boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_manage_event_door(p_event_id) then
    raise exception 'not allowed';
  end if;

  return query
  select
    t.id as ticket_id,
    t.code,
    coalesce(tt.name, 'Ticket') as ticket_type_name,
    t.buyer_id,
    coalesce(
      nullif(trim(t.guest_name), ''),
      nullif(
        trim(
          both ' '
          from concat_ws(
            ' ',
            nullif(trim(coalesce(p.display_name, '')), ''),
            nullif(trim(coalesce(p.last_name, '')), '')
          )
        ),
        ''
      )
    ) as guest_name,
    coalesce(nullif(trim(t.guest_email), ''), u.email::text) as guest_email,
    nullif(trim(t.guest_phone), '') as guest_phone,
    t.scanned_at,
    t.scanned_by,
    t.created_at as purchased_at,
    (t.scanned_at is not null) as is_scanned
  from public.event_tickets t
  left join public.event_ticket_types tt on tt.id = t.ticket_type_id
  left join public.profiles p on p.id = t.buyer_id
  left join auth.users u on u.id = t.buyer_id
  where t.event_id = p_event_id
  order by
    (t.scanned_at is not null) asc,
    lower(coalesce(t.guest_name, p.display_name, p.last_name, u.email, t.code)),
    t.created_at;
end;
$$;

revoke all on function public.list_event_door_guests(uuid) from public;
grant execute on function public.list_event_door_guests(uuid) to authenticated, service_role;

create or replace function public.scan_event_ticket(p_event_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  raw_code text := upper(trim(coalesce(p_code, '')));
  evt public.events%rowtype;
  ticket public.event_tickets%rowtype;
  guest_name text;
  guest_email text;
  ticket_type_name text;
  result_code text;
  payload jsonb;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_manage_event_door(p_event_id) then
    raise exception 'not allowed';
  end if;
  if raw_code = '' then
    raise exception 'code required';
  end if;

  select * into evt from public.events where id = p_event_id;
  if not found then
    raise exception 'event not found';
  end if;

  if evt.status = 'cancelled' then
    insert into public.event_ticket_scan_events (
      event_id, ticket_id, actor_id, code_attempt, result
    ) values (
      p_event_id, null, actor, raw_code, 'cancelled_event'
    );
    return jsonb_build_object(
      'ok', false,
      'result', 'cancelled_event',
      'message', 'This event is cancelled.'
    );
  end if;

  select * into ticket
  from public.event_tickets
  where lower(code) = lower(raw_code)
  for update;

  if not found then
    insert into public.event_ticket_scan_events (
      event_id, ticket_id, actor_id, code_attempt, result
    ) values (
      p_event_id, null, actor, raw_code, 'not_found'
    );
    return jsonb_build_object(
      'ok', false,
      'result', 'not_found',
      'message', 'No ticket matches that code.'
    );
  end if;

  if ticket.event_id is distinct from p_event_id then
    insert into public.event_ticket_scan_events (
      event_id, ticket_id, actor_id, code_attempt, result
    ) values (
      p_event_id, ticket.id, actor, raw_code, 'wrong_event'
    );
    return jsonb_build_object(
      'ok', false,
      'result', 'wrong_event',
      'message', 'That ticket belongs to a different event.'
    );
  end if;

  select coalesce(tt.name, 'Ticket') into ticket_type_name
  from public.event_ticket_types tt
  where tt.id = ticket.ticket_type_id;

  select
    coalesce(
      nullif(trim(ticket.guest_name), ''),
      nullif(
        trim(
          both ' '
          from concat_ws(
            ' ',
            nullif(trim(coalesce(p.display_name, '')), ''),
            nullif(trim(coalesce(p.last_name, '')), '')
          )
        ),
        ''
      )
    ),
    coalesce(nullif(trim(ticket.guest_email), ''), u.email::text)
  into guest_name, guest_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = ticket.buyer_id;

  if ticket.scanned_at is not null then
    result_code := 'already_scanned';
    insert into public.event_ticket_scan_events (
      event_id, ticket_id, actor_id, code_attempt, result
    ) values (
      p_event_id, ticket.id, actor, raw_code, result_code
    );
    payload := jsonb_build_object(
      'ok', false,
      'result', result_code,
      'message', 'Already scanned.',
      'ticket', jsonb_build_object(
        'id', ticket.id,
        'code', ticket.code,
        'ticketTypeName', coalesce(ticket_type_name, 'Ticket'),
        'guestName', guest_name,
        'guestEmail', guest_email,
        'scannedAt', ticket.scanned_at,
        'isScanned', true
      )
    );
    return payload;
  end if;

  update public.event_tickets
  set scanned_at = now(), scanned_by = actor
  where id = ticket.id
  returning * into ticket;

  result_code := 'ok';
  insert into public.event_ticket_scan_events (
    event_id, ticket_id, actor_id, code_attempt, result
  ) values (
    p_event_id, ticket.id, actor, raw_code, result_code
  );

  return jsonb_build_object(
    'ok', true,
    'result', result_code,
    'message', 'Guest checked in.',
    'ticket', jsonb_build_object(
      'id', ticket.id,
      'code', ticket.code,
      'ticketTypeName', coalesce(ticket_type_name, 'Ticket'),
      'guestName', guest_name,
      'guestEmail', guest_email,
      'scannedAt', ticket.scanned_at,
      'isScanned', true
    ),
    'stats', public.get_event_door_stats(p_event_id)
  );
end;
$$;

revoke all on function public.scan_event_ticket(uuid, text) from public;
grant execute on function public.scan_event_ticket(uuid, text) to authenticated, service_role;
