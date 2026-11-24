-- Event-day door for the Host Portal and Crew Portal.
-- Paid orders and complimentary tickets (no order) are the only expected admissions.
-- Crew QR codes are short-lived tokens. A scan identifies a person. Host confirmation grants access.

alter table public.event_crew_assignments
  add column if not exists permit_guest_search boolean not null default false,
  add column if not exists permit_manual_checkin boolean not null default false,
  add column if not exists revoked_at timestamptz;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'event_crew_assignments'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%permit_edit%';
  if constraint_name is not null then
    execute format('alter table public.event_crew_assignments drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.event_crew_assignments
  drop constraint if exists event_crew_assignments_role_permits;

alter table public.event_crew_assignments
  add constraint event_crew_assignments_role_permits
  check (
    role = 'event_manager'
    or (
      not permit_contacts
      and not permit_messages
      and not permit_invites
      and not permit_finances
      and not permit_refunds
      and not permit_edit
    )
  );

alter table public.event_ticket_scan_events
  add column if not exists device_label text,
  add column if not exists reason text,
  add column if not exists device_scanned_at timestamptz;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'event_ticket_scan_events'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%already_scanned%';
  if constraint_name is not null then
    execute format('alter table public.event_ticket_scan_events drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.event_ticket_scan_events
  drop constraint if exists event_ticket_scan_events_result_check;

alter table public.event_ticket_scan_events
  add constraint event_ticket_scan_events_result_check
  check (result in (
    'ok', 'already_scanned', 'wrong_event', 'not_found', 'cancelled_event',
    'refunded', 'void', 'manual_ok', 'undo', 'conflict', 'rejected'
  ));

create table if not exists public.event_crew_identity_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.event_crew_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  organiser_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  permit_guest_search boolean not null default false,
  permit_manual_checkin boolean not null default false,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  token_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table if not exists public.event_scan_operations (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete restrict,
  ticket_id uuid references public.event_tickets (id) on delete set null,
  code_attempt text not null,
  device_label text,
  device_scanned_at timestamptz not null,
  received_at timestamptz not null default now(),
  result text not null,
  detail text
);

create index if not exists event_scan_operations_event_idx
  on public.event_scan_operations (event_id, received_at desc);

create table if not exists public.event_attendee_updates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete restrict,
  audience text not null check (audience in ('all', 'checked_in', 'waiting')),
  body text not null check (char_length(btrim(body)) between 1 and 180),
  intended_count int not null default 0,
  accepted_count int not null default 0,
  failed_count int not null default 0,
  unreachable_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.event_crew_identity_tokens enable row level security;
alter table public.event_crew_invites enable row level security;
alter table public.event_scan_operations enable row level security;
alter table public.event_attendee_updates enable row level security;

revoke all on public.event_crew_identity_tokens from public, anon, authenticated;
revoke all on public.event_crew_invites from public, anon, authenticated;
revoke all on public.event_scan_operations from public, anon, authenticated;
revoke all on public.event_attendee_updates from public, anon, authenticated;
grant select on public.event_attendee_updates to authenticated, service_role;
grant all on public.event_crew_identity_tokens to service_role;
grant all on public.event_crew_invites to service_role;
grant all on public.event_scan_operations to service_role;
grant all on public.event_attendee_updates to service_role;

drop policy if exists "Hosts read their attendee updates" on public.event_attendee_updates;
create policy "Hosts read their attendee updates"
  on public.event_attendee_updates
  for select
  to authenticated
  using (
    sender_id = (select auth.uid())
    or (select public.is_staff())
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organiser_id = (select auth.uid())
    )
  );

create or replace function private.ticket_admission_state(p_order_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_order_id is null then 'expected'
    else coalesce((
      select case o.status::text
        when 'paid' then 'expected'
        when 'refunded' then 'refunded'
        else 'void'
      end
      from public.event_orders o
      where o.id = p_order_id
    ), 'void')
  end;
$$;

create or replace function private.token_hash(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function private.profile_label(p_user_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(trim(both ' ' from concat_ws(
      ' ',
      nullif(trim(coalesce(p.display_name, '')), ''),
      nullif(trim(coalesce(p.last_name, '')), '')
    )), ''),
    'Venturo member'
  )
  from public.profiles p
  where p.id = p_user_id;
$$;

create or replace function public.event_hub_can(p_event_id uuid, p_capability text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner uuid;
  creator uuid;
  assignment public.event_crew_assignments%rowtype;
begin
  if auth.uid() is null or p_event_id is null then
    return false;
  end if;

  if p_capability not in (
    'view_operations', 'scan_tickets', 'view_guest_contacts', 'send_messages',
    'invite_crew', 'view_finances', 'process_refunds', 'edit_event',
    'search_guests', 'manual_check_in'
  ) then
    return false;
  end if;

  if public.is_staff() then
    return true;
  end if;

  select e.organiser_id, e.created_by into owner, creator from public.events e where e.id = p_event_id;
  if not found then
    return false;
  end if;
  if owner = auth.uid() or creator = auth.uid() then
    return true;
  end if;

  select a.* into assignment
  from public.event_crew_assignments a
  join public.event_crew_assignment_events ae on ae.assignment_id = a.id
  where ae.event_id = p_event_id
    and a.user_id = auth.uid()
    and a.organiser_id = owner
    and a.status = 'active'
    and a.starts_at <= now()
    and a.expires_at > now()
  order by case when a.role = 'event_manager' then 0 else 1 end, a.expires_at desc
  limit 1;

  if not found then
    return false;
  end if;

  if assignment.role = 'check_in_crew' then
    return case p_capability
      when 'view_operations' then true
      when 'scan_tickets' then true
      when 'search_guests' then assignment.permit_guest_search
      when 'manual_check_in' then assignment.permit_manual_checkin
      else false
    end;
  end if;

  if p_capability in ('view_operations', 'scan_tickets', 'search_guests', 'manual_check_in') then
    return true;
  end if;

  return case p_capability
    when 'view_guest_contacts' then assignment.permit_contacts
    when 'send_messages' then assignment.permit_messages
    when 'invite_crew' then assignment.permit_invites
    when 'view_finances' then assignment.permit_finances
    when 'process_refunds' then assignment.permit_refunds
    when 'edit_event' then assignment.permit_edit
    else false
  end;
end;
$$;

revoke all on function public.event_hub_can(uuid, text) from public, anon;
grant execute on function public.event_hub_can(uuid, text) to authenticated, service_role;

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
  crew int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_manage_event_door(p_event_id) then
    raise exception 'not allowed';
  end if;

  select
    count(*) filter (where private.ticket_admission_state(t.order_id) = 'expected')::int,
    count(*) filter (
      where private.ticket_admission_state(t.order_id) = 'expected'
        and t.scanned_at is not null
    )::int
  into total, scanned
  from public.event_tickets t
  where t.event_id = p_event_id;

  select count(distinct a.user_id)::int into crew
  from public.event_crew_assignments a
  join public.event_crew_assignment_events ae on ae.assignment_id = a.id
  where ae.event_id = p_event_id
    and a.status = 'active'
    and a.starts_at <= now()
    and a.expires_at > now();

  return jsonb_build_object(
    'eventId', p_event_id,
    'totalGuests', total,
    'scannedGuests', scanned,
    'remainingGuests', greatest(total - scanned, 0),
    'activeCrew', crew
  );
end;
$$;

revoke all on function public.get_event_door_stats(uuid) from public;
grant execute on function public.get_event_door_stats(uuid) to authenticated, service_role;

drop function if exists public.list_event_door_guests(uuid);

create or replace function public.list_event_door_guests(p_event_id uuid)
returns table (
  ticket_id uuid,
  code text,
  ticket_type_name text,
  buyer_id uuid,
  order_id uuid,
  guest_name text,
  guest_email text,
  guest_phone text,
  scanned_at timestamptz,
  scanned_by uuid,
  purchased_at timestamptz,
  is_scanned boolean,
  occurrence_starts_at timestamptz,
  admission_state text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  show_contacts boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not (
    public.event_hub_can(p_event_id, 'search_guests')
    or public.event_hub_legacy_door_contact(p_event_id)
  ) then
    raise exception 'not allowed';
  end if;

  show_contacts := public.event_hub_can(p_event_id, 'view_guest_contacts')
    or public.event_hub_legacy_door_contact(p_event_id);

  return query
  select
    t.id,
    t.code,
    coalesce(tt.name, 'Ticket'),
    t.buyer_id,
    t.order_id,
    coalesce(
      nullif(trim(t.guest_name), ''),
      nullif(trim(both ' ' from concat_ws(
        ' ',
        nullif(trim(coalesce(p.display_name, '')), ''),
        nullif(trim(coalesce(p.last_name, '')), '')
      )), '')
    ),
    case when show_contacts then coalesce(nullif(trim(t.guest_email), ''), u.email::text) else null end,
    case when show_contacts then nullif(trim(t.guest_phone), '') else null end,
    t.scanned_at,
    t.scanned_by,
    t.created_at,
    (t.scanned_at is not null),
    t.occurrence_starts_at,
    private.ticket_admission_state(t.order_id)
  from public.event_tickets t
  left join public.event_ticket_types tt on tt.id = t.ticket_type_id
  left join public.profiles p on p.id = t.buyer_id
  left join auth.users u on u.id = t.buyer_id
  where t.event_id = p_event_id
  order by (t.scanned_at is not null), lower(coalesce(t.guest_name, t.code)), t.created_at;
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
  ticket_type_name text;
  state text;
  result_code text;
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

  if evt.status::text = 'cancelled' then
    insert into public.event_ticket_scan_events (event_id, actor_id, code_attempt, result)
    values (p_event_id, actor, raw_code, 'cancelled_event');
    return jsonb_build_object('ok', false, 'result', 'cancelled_event', 'message', 'This event is cancelled.');
  end if;

  select * into ticket from public.event_tickets where lower(code) = lower(raw_code) for update;
  if not found then
    insert into public.event_ticket_scan_events (event_id, actor_id, code_attempt, result)
    values (p_event_id, actor, raw_code, 'not_found');
    return jsonb_build_object('ok', false, 'result', 'not_found', 'message', 'No ticket matches that code.');
  end if;

  if ticket.event_id is distinct from p_event_id then
    insert into public.event_ticket_scan_events (event_id, ticket_id, actor_id, code_attempt, result)
    values (p_event_id, ticket.id, actor, raw_code, 'wrong_event');
    return jsonb_build_object('ok', false, 'result', 'wrong_event', 'message', 'That ticket belongs to a different event.');
  end if;

  select coalesce(tt.name, 'Ticket') into ticket_type_name
  from public.event_ticket_types tt where tt.id = ticket.ticket_type_id;

  guest_name := coalesce(nullif(trim(coalesce(ticket.guest_name, '')), ''), private.profile_label(ticket.buyer_id), 'Guest');
  state := private.ticket_admission_state(ticket.order_id);

  if state <> 'expected' then
    result_code := state;
    insert into public.event_ticket_scan_events (event_id, ticket_id, actor_id, code_attempt, result)
    values (p_event_id, ticket.id, actor, raw_code, result_code);
    return jsonb_build_object(
      'ok', false,
      'result', result_code,
      'message', case when result_code = 'refunded' then 'This ticket was refunded.' else 'This ticket is not valid.' end,
      'ticket', jsonb_build_object('id', ticket.id, 'guestName', guest_name, 'ticketTypeName', coalesce(ticket_type_name, 'Ticket'))
    );
  end if;

  if ticket.scanned_at is not null then
    insert into public.event_ticket_scan_events (event_id, ticket_id, actor_id, code_attempt, result)
    values (p_event_id, ticket.id, actor, raw_code, 'already_scanned');
    return jsonb_build_object(
      'ok', false,
      'result', 'already_scanned',
      'message', 'Already checked in.',
      'ticket', jsonb_build_object(
        'id', ticket.id,
        'guestName', guest_name,
        'ticketTypeName', coalesce(ticket_type_name, 'Ticket'),
        'scannedAt', ticket.scanned_at
      )
    );
  end if;

  update public.event_tickets
  set scanned_at = now(), scanned_by = actor
  where id = ticket.id
  returning * into ticket;

  insert into public.event_ticket_scan_events (event_id, ticket_id, actor_id, code_attempt, result)
  values (p_event_id, ticket.id, actor, raw_code, 'ok');

  return jsonb_build_object(
    'ok', true,
    'result', 'ok',
    'message', 'Guest checked in.',
    'ticket', jsonb_build_object(
      'id', ticket.id,
      'guestName', guest_name,
      'ticketTypeName', coalesce(ticket_type_name, 'Ticket'),
      'scannedAt', ticket.scanned_at
    ),
    'stats', public.get_event_door_stats(p_event_id)
  );
end;
$$;

revoke all on function public.scan_event_ticket(uuid, text) from public;
grant execute on function public.scan_event_ticket(uuid, text) to authenticated, service_role;

create or replace function public.manual_check_in(
  p_event_id uuid,
  p_ticket_id uuid,
  p_reason text,
  p_device text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  ticket public.event_tickets%rowtype;
  reason text := nullif(trim(coalesce(p_reason, '')), '');
  state text;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if reason is null then
    raise exception 'reason required';
  end if;
  if not public.event_hub_can(p_event_id, 'manual_check_in') then
    raise exception 'not allowed';
  end if;

  select * into ticket from public.event_tickets where id = p_ticket_id and event_id = p_event_id for update;
  if not found then
    raise exception 'ticket not found';
  end if;
  state := private.ticket_admission_state(ticket.order_id);
  if state <> 'expected' then
    raise exception 'ticket is not valid';
  end if;
  if ticket.scanned_at is not null then
    return jsonb_build_object('ok', false, 'result', 'already_scanned', 'message', 'Already checked in.', 'scannedAt', ticket.scanned_at);
  end if;

  update public.event_tickets set scanned_at = now(), scanned_by = actor where id = ticket.id;
  insert into public.event_ticket_scan_events (event_id, ticket_id, actor_id, code_attempt, result, reason, device_label)
  values (p_event_id, ticket.id, actor, ticket.code, 'manual_ok', reason, nullif(trim(coalesce(p_device, '')), ''));
  return jsonb_build_object('ok', true, 'result', 'manual_ok', 'message', 'Guest checked in.');
end;
$$;

revoke all on function public.manual_check_in(uuid, uuid, text, text) from public;
grant execute on function public.manual_check_in(uuid, uuid, text, text) to authenticated, service_role;

create or replace function public.undo_check_in(
  p_event_id uuid,
  p_ticket_id uuid,
  p_reason text,
  p_device text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  ticket public.event_tickets%rowtype;
  reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if reason is null then
    raise exception 'reason required';
  end if;
  if not public.event_hub_can(p_event_id, 'manual_check_in') then
    raise exception 'not allowed';
  end if;

  select * into ticket from public.event_tickets where id = p_ticket_id and event_id = p_event_id for update;
  if not found then
    raise exception 'ticket not found';
  end if;
  if ticket.scanned_at is null then
    return jsonb_build_object('ok', false, 'result', 'not_found', 'message', 'This ticket is not checked in.');
  end if;

  update public.event_tickets set scanned_at = null, scanned_by = null where id = ticket.id;
  insert into public.event_ticket_scan_events (event_id, ticket_id, actor_id, code_attempt, result, reason, device_label)
  values (p_event_id, ticket.id, actor, ticket.code, 'undo', reason, nullif(trim(coalesce(p_device, '')), ''));
  return jsonb_build_object('ok', true, 'result', 'undo', 'message', 'Check-in removed. A later scan can admit this guest.');
end;
$$;

revoke all on function public.undo_check_in(uuid, uuid, text, text) from public;
grant execute on function public.undo_check_in(uuid, uuid, text, text) to authenticated, service_role;

create or replace function public.list_host_events()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x."startsAt")
    from (
      select
        e.id,
        e.title,
        e.status,
        e.starts_at as "startsAt",
        e.ends_at as "endsAt",
        coalesce(e.venue_name, '') as "venueName",
        e.city,
        e.timezone,
        case
          when e.organiser_id = auth.uid() or public.is_staff() then 'host'
          else 'manager'
        end as role,
        (
          select count(*)::int
          from public.event_tickets t
          where t.event_id = e.id
            and private.ticket_admission_state(t.order_id) = 'expected'
        ) as "totalGuests",
        (
          select count(*)::int
          from public.event_tickets t
          where t.event_id = e.id
            and private.ticket_admission_state(t.order_id) = 'expected'
            and t.scanned_at is not null
        ) as "scannedGuests",
        coalesce(e.listing_image_url, e.banner_url) as "imageUrl"
      from public.events e
      where e.organiser_id = auth.uid()
        or e.created_by = auth.uid()
        or public.is_staff()
        or exists (
          select 1
          from public.event_crew_assignment_events ae
          join public.event_crew_assignments a on a.id = ae.assignment_id
          where ae.event_id = e.id
            and a.user_id = auth.uid()
            and a.role = 'event_manager'
            and a.status = 'active'
            and a.starts_at <= now()
            and a.expires_at > now()
        )
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_host_events() from public;
grant execute on function public.list_host_events() to authenticated, service_role;

create or replace function public.list_crew_events()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x."startsAt")
    from (
      select
        e.id,
        e.title,
        e.status,
        e.starts_at as "startsAt",
        e.ends_at as "endsAt",
        coalesce(e.venue_name, '') as "venueName",
        e.city,
        e.timezone,
        coalesce(e.listing_image_url, e.banner_url) as "imageUrl",
        a.status as "assignmentStatus",
        a.starts_at as "accessStarts",
        a.expires_at as "accessEnds",
        a.permit_guest_search as "canSearch",
        a.permit_manual_checkin as "canManual",
        private.profile_label(e.organiser_id) as "hostName",
        case
          when op.telephone_public then nullif(trim(coalesce(op.telephone, '')), '')
          else null
        end as "hostPhone"
      from public.event_crew_assignments a
      join public.event_crew_assignment_events ae on ae.assignment_id = a.id
      join public.events e on e.id = ae.event_id
      left join public.organiser_profiles op on op.user_id = e.organiser_id
      where a.user_id = auth.uid()
        and a.status in ('pending', 'active')
        and a.expires_at > now()
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_crew_events() from public;
grant execute on function public.list_crew_events() to authenticated, service_role;

create or replace function public.issue_crew_identity()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor uuid := auth.uid();
  recent int;
  raw text;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  select count(*) into recent
  from public.event_crew_identity_tokens
  where user_id = actor and created_at > now() - interval '1 hour';
  if recent >= 12 then
    raise exception 'too many crew codes';
  end if;
  raw := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.event_crew_identity_tokens (token_hash, user_id, expires_at)
  values (private.token_hash(raw), actor, now() + interval '10 minutes');
  return jsonb_build_object('token', raw, 'expiresAt', now() + interval '10 minutes');
end;
$$;

revoke all on function public.issue_crew_identity() from public;
grant execute on function public.issue_crew_identity() to authenticated, service_role;

create or replace function public.preview_crew_identity(p_event_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.event_crew_identity_tokens%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.event_hub_can(p_event_id, 'invite_crew') then
    raise exception 'not allowed';
  end if;
  select * into row
  from public.event_crew_identity_tokens
  where token_hash = private.token_hash(p_token)
    and consumed_at is null
    and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'message', 'That crew code has expired.');
  end if;
  return jsonb_build_object('ok', true, 'name', coalesce(private.profile_label(row.user_id), 'Venturo member'));
end;
$$;

revoke all on function public.preview_crew_identity(uuid, text) from public;
grant execute on function public.preview_crew_identity(uuid, text) to authenticated, service_role;

create or replace function private.event_access_window(
  p_event_id uuid,
  p_starts timestamptz,
  p_expires timestamptz,
  out starts_at timestamptz,
  out expires_at timestamptz
)
language plpgsql
stable
set search_path = public
as $$
declare
  evt public.events%rowtype;
begin
  select * into evt from public.events where id = p_event_id;
  starts_at := coalesce(p_starts, evt.starts_at, now());
  expires_at := coalesce(p_expires, evt.ends_at + interval '6 hours', starts_at + interval '6 hours');
  if expires_at <= starts_at then
    expires_at := starts_at + interval '6 hours';
  end if;
end;
$$;

create or replace function public.confirm_crew_assignment(
  p_event_id uuid,
  p_token text,
  p_permit_guest_search boolean default false,
  p_permit_manual_checkin boolean default false,
  p_starts timestamptz default null,
  p_expires timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  ident public.event_crew_identity_tokens%rowtype;
  owner uuid;
  window_start timestamptz;
  window_end timestamptz;
  existing uuid;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if not public.event_hub_can(p_event_id, 'invite_crew') then
    raise exception 'not allowed';
  end if;

  select * into ident
  from public.event_crew_identity_tokens
  where token_hash = private.token_hash(p_token)
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'That crew code has expired.');
  end if;

  select organiser_id into owner from public.events where id = p_event_id;
  select starts_at, expires_at into window_start, window_end
  from private.event_access_window(p_event_id, p_starts, p_expires);

  select a.id into existing
  from public.event_crew_assignments a
  join public.event_crew_assignment_events ae on ae.assignment_id = a.id
  where ae.event_id = p_event_id and a.user_id = ident.user_id
  limit 1;

  if existing is null then
    insert into public.event_crew_assignments (
      user_id, organiser_id, role, status,
      permit_guest_search, permit_manual_checkin,
      starts_at, expires_at, approved_by
    ) values (
      ident.user_id, owner, 'check_in_crew', 'active',
      coalesce(p_permit_guest_search, false), coalesce(p_permit_manual_checkin, false),
      window_start, window_end, actor
    ) returning id into existing;
    insert into public.event_crew_assignment_events (assignment_id, event_id)
    values (existing, p_event_id);
  else
    update public.event_crew_assignments
    set status = 'active',
        revoked_at = null,
        permit_guest_search = coalesce(p_permit_guest_search, false),
        permit_manual_checkin = coalesce(p_permit_manual_checkin, false),
        starts_at = window_start,
        expires_at = window_end,
        approved_by = actor
    where id = existing;
  end if;

  update public.event_crew_identity_tokens set consumed_at = now() where id = ident.id;
  return jsonb_build_object('ok', true, 'name', coalesce(private.profile_label(ident.user_id), 'Venturo member'), 'assignmentId', existing);
end;
$$;

revoke all on function public.confirm_crew_assignment(uuid, text, boolean, boolean, timestamptz, timestamptz) from public;
grant execute on function public.confirm_crew_assignment(uuid, text, boolean, boolean, timestamptz, timestamptz) to authenticated, service_role;

create or replace function public.issue_event_invite(
  p_event_id uuid,
  p_permit_guest_search boolean default false,
  p_permit_manual_checkin boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor uuid := auth.uid();
  owner uuid;
  recent int;
  raw text;
  window_start timestamptz;
  window_end timestamptz;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if not public.event_hub_can(p_event_id, 'invite_crew') then
    raise exception 'not allowed';
  end if;
  select count(*) into recent
  from public.event_crew_invites
  where event_id = p_event_id and created_at > now() - interval '1 hour';
  if recent >= 20 then
    raise exception 'too many invites';
  end if;
  select organiser_id into owner from public.events where id = p_event_id;
  select starts_at, expires_at into window_start, window_end
  from private.event_access_window(p_event_id, null, null);
  raw := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.event_crew_invites (
    event_id, organiser_id, token_hash, permit_guest_search, permit_manual_checkin,
    starts_at, expires_at, token_expires_at, created_by
  ) values (
    p_event_id, owner, private.token_hash(raw),
    coalesce(p_permit_guest_search, false), coalesce(p_permit_manual_checkin, false),
    window_start, window_end, now() + interval '2 hours', actor
  );
  return jsonb_build_object('token', raw, 'expiresAt', now() + interval '2 hours');
end;
$$;

revoke all on function public.issue_event_invite(uuid, boolean, boolean) from public;
grant execute on function public.issue_event_invite(uuid, boolean, boolean) to authenticated, service_role;

create or replace function public.revoke_event_invite(p_event_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.event_hub_can(p_event_id, 'invite_crew') then
    raise exception 'not allowed';
  end if;
  update public.event_crew_invites
  set revoked_at = now()
  where event_id = p_event_id and token_hash = private.token_hash(p_token) and revoked_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.revoke_event_invite(uuid, text) from public;
grant execute on function public.revoke_event_invite(uuid, text) to authenticated, service_role;

create or replace function public.request_crew_join(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  invite public.event_crew_invites%rowtype;
  existing uuid;
  recent int;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  select count(*) into recent
  from public.event_crew_assignments
  where user_id = actor and created_at > now() - interval '1 hour';
  if recent >= 12 then
    raise exception 'too many join requests';
  end if;

  select * into invite
  from public.event_crew_invites
  where token_hash = private.token_hash(p_token)
    and revoked_at is null
    and token_expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'message', 'That invite has expired.');
  end if;

  select a.id into existing
  from public.event_crew_assignments a
  join public.event_crew_assignment_events ae on ae.assignment_id = a.id
  where ae.event_id = invite.event_id and a.user_id = actor
  limit 1;

  if existing is null then
    insert into public.event_crew_assignments (
      user_id, organiser_id, role, status,
      permit_guest_search, permit_manual_checkin,
      starts_at, expires_at
    ) values (
      actor, invite.organiser_id, 'check_in_crew', 'pending',
      invite.permit_guest_search, invite.permit_manual_checkin,
      invite.starts_at, invite.expires_at
    ) returning id into existing;
    insert into public.event_crew_assignment_events (assignment_id, event_id)
    values (existing, invite.event_id);
  else
    update public.event_crew_assignments
    set status = case when status = 'active' then 'active' else 'pending' end,
        permit_guest_search = invite.permit_guest_search,
        permit_manual_checkin = invite.permit_manual_checkin,
        starts_at = invite.starts_at,
        expires_at = invite.expires_at
    where id = existing and status <> 'active';
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', (select status from public.event_crew_assignments where id = existing),
    'eventId', invite.event_id
  );
end;
$$;

revoke all on function public.request_crew_join(text) from public;
grant execute on function public.request_crew_join(text) to authenticated, service_role;

create or replace function public.list_event_crew(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.event_hub_can(p_event_id, 'invite_crew') then
    raise exception 'not allowed';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.status, x.name)
    from (
      select
        a.id,
        a.status,
        a.starts_at as "accessStarts",
        a.expires_at as "accessEnds",
        a.permit_guest_search as "canSearch",
        a.permit_manual_checkin as "canManual",
        coalesce(private.profile_label(a.user_id), 'Venturo member') as name
      from public.event_crew_assignments a
      join public.event_crew_assignment_events ae on ae.assignment_id = a.id
      where ae.event_id = p_event_id
        and a.status in ('pending', 'active')
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_event_crew(uuid) from public;
grant execute on function public.list_event_crew(uuid) to authenticated, service_role;

create or replace function public.review_crew_join(p_event_id uuid, p_assignment_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.event_crew_assignments%rowtype;
begin
  if not public.event_hub_can(p_event_id, 'invite_crew') then
    raise exception 'not allowed';
  end if;
  select a.* into row
  from public.event_crew_assignments a
  join public.event_crew_assignment_events ae on ae.assignment_id = a.id
  where a.id = p_assignment_id and ae.event_id = p_event_id
  for update;
  if not found then
    raise exception 'assignment not found';
  end if;
  if p_approve then
    update public.event_crew_assignments
    set status = 'active', revoked_at = null, approved_by = auth.uid()
    where id = row.id;
  else
    update public.event_crew_assignments
    set status = 'revoked', revoked_at = now(), approved_by = auth.uid()
    where id = row.id;
  end if;
  return jsonb_build_object('ok', true, 'status', case when p_approve then 'active' else 'revoked' end);
end;
$$;

revoke all on function public.review_crew_join(uuid, uuid, boolean) from public;
grant execute on function public.review_crew_join(uuid, uuid, boolean) to authenticated, service_role;

create or replace function public.revoke_crew_assignment(p_event_id uuid, p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.event_hub_can(p_event_id, 'invite_crew') then
    raise exception 'not allowed';
  end if;
  update public.event_crew_assignments a
  set status = 'revoked', revoked_at = now()
  where a.id = p_assignment_id
    and exists (
      select 1 from public.event_crew_assignment_events ae
      where ae.assignment_id = a.id and ae.event_id = p_event_id
    );
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.revoke_crew_assignment(uuid, uuid) from public;
grant execute on function public.revoke_crew_assignment(uuid, uuid) to authenticated, service_role;

create or replace function public.prepare_event_scan(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  access_end timestamptz;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_manage_event_door(p_event_id) then
    raise exception 'not allowed';
  end if;

  select min(a.expires_at) into access_end
  from public.event_crew_assignments a
  join public.event_crew_assignment_events ae on ae.assignment_id = a.id
  where ae.event_id = p_event_id and a.user_id = actor and a.status = 'active';

  return jsonb_build_object(
    'syncedAt', now(),
    'expiresAt', access_end,
    'canSearch', public.event_hub_can(p_event_id, 'search_guests'),
    'canManual', public.event_hub_can(p_event_id, 'manual_check_in'),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'code', t.code,
        'guestName', coalesce(nullif(trim(t.guest_name), ''), private.profile_label(t.buyer_id), 'Guest'),
        'ticketType', coalesce(tt.name, 'Ticket'),
        'scannedAt', t.scanned_at,
        'orderId', t.order_id
      ))
      from public.event_tickets t
      left join public.event_ticket_types tt on tt.id = t.ticket_type_id
      where t.event_id = p_event_id
        and private.ticket_admission_state(t.order_id) = 'expected'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.prepare_event_scan(uuid) from public;
grant execute on function public.prepare_event_scan(uuid) to authenticated, service_role;

create or replace function private.scan_was_authorised(p_event_id uuid, p_actor uuid, p_when timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_staff()
    or exists (
      select 1 from public.events e
      where e.id = p_event_id and (e.organiser_id = p_actor or e.created_by = p_actor)
    )
    or exists (
      select 1
      from public.event_crew_assignments a
      join public.event_crew_assignment_events ae on ae.assignment_id = a.id
      where ae.event_id = p_event_id
        and a.user_id = p_actor
        and a.starts_at <= p_when
        and a.expires_at > p_when
        and (a.revoked_at is null or a.revoked_at > p_when)
        and a.status in ('active', 'expired', 'revoked')
    );
$$;

create or replace function public.sync_event_scans(p_event_id uuid, p_device text, p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  op jsonb;
  op_id uuid;
  raw_code text;
  when_at timestamptz;
  prior public.event_scan_operations%rowtype;
  ticket public.event_tickets%rowtype;
  found_ticket uuid;
  state text;
  result_code text;
  detail text;
  results jsonb := '[]'::jsonb;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_typeof(p_ops) <> 'array' then
    raise exception 'operations required';
  end if;

  for op in select value from jsonb_array_elements(p_ops) loop
    op_id := nullif(op->>'id', '')::uuid;
    raw_code := upper(trim(coalesce(op->>'code', '')));
    when_at := coalesce((op->>'scannedAt')::timestamptz, now());
    if op_id is null or raw_code = '' then
      continue;
    end if;

    select * into prior from public.event_scan_operations where id = op_id;
    if found then
      results := results || jsonb_build_array(jsonb_build_object(
        'id', prior.id, 'result', prior.result, 'detail', prior.detail
      ));
      continue;
    end if;

    if not private.scan_was_authorised(p_event_id, actor, when_at) then
      result_code := 'rejected';
      detail := 'Access was not valid at the scan time.';
      insert into public.event_scan_operations (
        id, event_id, actor_id, code_attempt, device_label, device_scanned_at, result, detail
      ) values (
        op_id, p_event_id, actor, raw_code, nullif(trim(coalesce(p_device, '')), ''), when_at, result_code, detail
      );
      insert into public.event_ticket_scan_events (
        event_id, actor_id, code_attempt, result, device_label, device_scanned_at, reason
      ) values (
        p_event_id, actor, raw_code, 'rejected', nullif(trim(coalesce(p_device, '')), ''), when_at, detail
      );
    else
      select * into ticket
      from public.event_tickets
      where lower(event_tickets.code) = lower(raw_code)
      for update;

      found_ticket := null;
      if not found then
        result_code := 'not_found';
        detail := 'No ticket matches that code.';
      elsif ticket.event_id is distinct from p_event_id then
        found_ticket := ticket.id;
        result_code := 'wrong_event';
        detail := 'That ticket belongs to a different event.';
      else
        found_ticket := ticket.id;
        state := private.ticket_admission_state(ticket.order_id);
        if state <> 'expected' then
          result_code := state;
          detail := case when state = 'refunded' then 'This ticket was refunded.' else 'This ticket is not valid.' end;
        elsif ticket.scanned_at is not null then
          result_code := 'conflict';
          detail := 'Another door already admitted this ticket.';
        else
          update public.event_tickets
          set scanned_at = now(), scanned_by = actor
          where id = ticket.id;
          result_code := 'ok';
          detail := 'Guest checked in.';
        end if;
      end if;

      insert into public.event_scan_operations (
        id, event_id, actor_id, ticket_id, code_attempt, device_label, device_scanned_at, result, detail
      ) values (
        op_id, p_event_id, actor, found_ticket, raw_code, nullif(trim(coalesce(p_device, '')), ''), when_at, result_code, detail
      );
      insert into public.event_ticket_scan_events (
        event_id, ticket_id, actor_id, code_attempt, result, device_label, device_scanned_at, reason
      ) values (
        p_event_id, found_ticket, actor, raw_code, result_code, nullif(trim(coalesce(p_device, '')), ''), when_at, detail
      );
    end if;

    results := results || jsonb_build_array(jsonb_build_object(
      'id', op_id, 'result', result_code, 'detail', detail
    ));
  end loop;

  return jsonb_build_object('ok', true, 'results', results);
end;
$$;

revoke all on function public.sync_event_scans(uuid, text, jsonb) from public;
grant execute on function public.sync_event_scans(uuid, text, jsonb) to authenticated, service_role;

create or replace function public.event_update_audience(p_event_id uuid, p_audience text)
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_audience not in ('all', 'checked_in', 'waiting') then
    raise exception 'unknown audience';
  end if;
  if not public.event_hub_can(p_event_id, 'send_messages') then
    raise exception 'not allowed';
  end if;

  return query
  select distinct t.buyer_id
  from public.event_tickets t
  where t.event_id = p_event_id
    and t.buyer_id is not null
    and private.ticket_admission_state(t.order_id) = 'expected'
    and (
      p_audience = 'all'
      or (p_audience = 'checked_in' and t.scanned_at is not null)
      or (p_audience = 'waiting' and t.scanned_at is null)
    );
end;
$$;

revoke all on function public.event_update_audience(uuid, text) from public;
grant execute on function public.event_update_audience(uuid, text) to authenticated, service_role;

create or replace function public.record_attendee_update(
  p_event_id uuid,
  p_audience text,
  p_body text,
  p_intended int,
  p_accepted int,
  p_failed int,
  p_unreachable int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  recent int;
  same int;
  created uuid;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if not public.event_hub_can(p_event_id, 'send_messages') then
    raise exception 'not allowed';
  end if;
  if p_audience not in ('all', 'checked_in', 'waiting') then
    raise exception 'unknown audience';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 180 then
    raise exception 'message length';
  end if;

  select count(*) into recent
  from public.event_attendee_updates
  where event_id = p_event_id and created_at > now() - interval '1 hour';
  if recent >= 6 then
    raise exception 'too many updates';
  end if;

  select count(*) into same
  from public.event_attendee_updates
  where event_id = p_event_id
    and audience = p_audience
    and body = btrim(p_body)
    and created_at > now() - interval '2 minutes';
  if same > 0 then
    raise exception 'duplicate update';
  end if;

  insert into public.event_attendee_updates (
    event_id, sender_id, audience, body, intended_count, accepted_count, failed_count, unreachable_count
  ) values (
    p_event_id, actor, p_audience, btrim(p_body),
    greatest(p_intended, 0), greatest(p_accepted, 0), greatest(p_failed, 0), greatest(p_unreachable, 0)
  ) returning id into created;
  return created;
end;
$$;

revoke all on function public.record_attendee_update(uuid, text, text, int, int, int, int) from public;
grant execute on function public.record_attendee_update(uuid, text, text, int, int, int, int) to authenticated, service_role;

create or replace function public.preview_event_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  title text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select e.title into title
  from public.event_crew_invites i
  join public.events e on e.id = i.event_id
  where i.token_hash = private.token_hash(p_token)
    and i.revoked_at is null
    and i.token_expires_at > now();
  if title is null then
    return jsonb_build_object('ok', false, 'message', 'That invite has expired.');
  end if;
  return jsonb_build_object('ok', true, 'title', title, 'message', 'Ask the host to approve you.');
end;
$$;

revoke all on function public.preview_event_invite(text) from public;
grant execute on function public.preview_event_invite(text) to authenticated, service_role;

create or replace function public.can_manage_event_door(p_event_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (
        e.organiser_id = auth.uid()
        or e.created_by = auth.uid()
        or public.is_staff()
      )
  ) into allowed;

  if allowed then
    return true;
  end if;

  if public.event_hub_legacy_door_contact(p_event_id) then
    return true;
  end if;

  return public.event_hub_can(p_event_id, 'scan_tickets');
end;
$$;

revoke all on function public.can_manage_event_door(uuid) from public;
grant execute on function public.can_manage_event_door(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
