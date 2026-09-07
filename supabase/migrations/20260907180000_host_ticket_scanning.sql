-- Host companion: door check-in for event tickets.
-- Organisers (and staff) scan ticket codes, see live guest counts, and browse the door list.
-- Guest PII for the door list is exposed only through security-definer RPCs (not open profile RLS).

-- ---------------------------------------------------------------------------
-- Ticket check-in columns
-- ---------------------------------------------------------------------------

alter table public.event_tickets
  add column if not exists scanned_at timestamptz,
  add column if not exists scanned_by uuid references auth.users (id) on delete set null;

create index if not exists event_tickets_event_scanned_idx
  on public.event_tickets (event_id, scanned_at);

create index if not exists event_tickets_code_lower_idx
  on public.event_tickets (lower(code));

-- ---------------------------------------------------------------------------
-- Scan audit (every attempt — success, duplicate, wrong event, unknown)
-- ---------------------------------------------------------------------------

create table if not exists public.event_ticket_scan_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  ticket_id uuid references public.event_tickets (id) on delete set null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  code_attempt text not null,
  result text not null
    check (result in ('ok', 'already_scanned', 'wrong_event', 'not_found', 'cancelled_event')),
  created_at timestamptz not null default now()
);

create index if not exists event_ticket_scan_events_event_idx
  on public.event_ticket_scan_events (event_id, created_at desc);

alter table public.event_ticket_scan_events enable row level security;

create policy "Organisers and staff read scan audit"
  on public.event_ticket_scan_events
  for select
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organiser_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------

create or replace function public.can_manage_event_door(p_event_id uuid)
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
      and (
        e.organiser_id = auth.uid()
        or public.is_staff()
      )
  );
$$;

revoke all on function public.can_manage_event_door(uuid) from public;
grant execute on function public.can_manage_event_door(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Door stats
-- ---------------------------------------------------------------------------

create or replace function public.get_event_door_stats(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  total int := 0;
  scanned int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_manage_event_door(p_event_id) then
    raise exception 'not allowed';
  end if;

  select
    count(*)::int,
    count(*) filter (where scanned_at is not null)::int
  into total, scanned
  from public.event_tickets
  where event_id = p_event_id;

  return jsonb_build_object(
    'eventId', p_event_id,
    'totalGuests', total,
    'scannedGuests', scanned,
    'remainingGuests', greatest(total - scanned, 0)
  );
end;
$$;

revoke all on function public.get_event_door_stats(uuid) from public;
grant execute on function public.get_event_door_stats(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Guest / door list (includes buyer profile + email for the host)
-- ---------------------------------------------------------------------------

create or replace function public.list_event_door_guests(p_event_id uuid)
returns table (
  ticket_id uuid,
  code text,
  ticket_type_name text,
  buyer_id uuid,
  guest_name text,
  guest_email text,
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
    nullif(
      trim(
        both ' '
        from concat_ws(
          ' ',
          nullif(trim(coalesce(p.display_name, p.first_name, '')), ''),
          nullif(trim(coalesce(p.last_name, '')), '')
        )
      ),
      ''
    ) as guest_name,
    u.email::text as guest_email,
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
    lower(coalesce(p.display_name, p.first_name, u.email, t.code)),
    t.created_at;
end;
$$;

revoke all on function public.list_event_door_guests(uuid) from public;
grant execute on function public.list_event_door_guests(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Scan / redeem a ticket code for an event (idempotent duplicate reporting)
-- ---------------------------------------------------------------------------

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
    nullif(
      trim(
        both ' '
        from concat_ws(
          ' ',
          nullif(trim(coalesce(p.display_name, p.first_name, '')), ''),
          nullif(trim(coalesce(p.last_name, '')), '')
        )
      ),
      ''
    ),
    u.email::text
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
