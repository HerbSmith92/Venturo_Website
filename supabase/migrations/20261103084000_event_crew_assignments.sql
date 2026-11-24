-- Event Hub crew access. Host ownership stays events.organiser_id.
-- Roles stay in app_metadata. A crew row is an event grant, not an account type.
-- Later event RPCs must call public.event_hub_can before returning data.
-- Check-in crew may scan & see limited operations. Contacts & finances stay closed
-- unless the assignment is an event manager with that permission set.

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------

create table if not exists public.event_crew_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organiser_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('event_manager', 'check_in_crew')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'revoked')),
  permit_contacts boolean not null default false,
  permit_messages boolean not null default false,
  permit_invites boolean not null default false,
  permit_finances boolean not null default false,
  permit_refunds boolean not null default false,
  permit_edit boolean not null default false,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at),
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
  )
);

create table if not exists public.event_crew_assignment_events (
  assignment_id uuid not null references public.event_crew_assignments (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  primary key (assignment_id, event_id)
);

create index if not exists event_crew_assignments_user_status_idx
  on public.event_crew_assignments (user_id, status, expires_at);

create index if not exists event_crew_assignments_organiser_idx
  on public.event_crew_assignments (organiser_id);

create index if not exists event_crew_assignment_events_event_idx
  on public.event_crew_assignment_events (event_id);

create schema if not exists private;

create or replace function private.touch_event_crew_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_crew_assignments_touch on public.event_crew_assignments;
create trigger event_crew_assignments_touch
  before update on public.event_crew_assignments
  for each row
  execute function private.touch_event_crew_assignment();

alter table public.event_crew_assignments enable row level security;
alter table public.event_crew_assignment_events enable row level security;

revoke all on public.event_crew_assignments from public, anon;
revoke all on public.event_crew_assignment_events from public, anon;
grant select, insert, update on public.event_crew_assignments to authenticated, service_role;
grant select, insert, update, delete on public.event_crew_assignment_events to authenticated, service_role;

drop policy if exists "Crew, assigning host, or staff read assignments" on public.event_crew_assignments;
create policy "Crew, assigning host, or staff read assignments"
  on public.event_crew_assignments
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or organiser_id = (select auth.uid())
    or (select public.is_staff())
  );

drop policy if exists "Assigning host or staff create assignments" on public.event_crew_assignments;
create policy "Assigning host or staff create assignments"
  on public.event_crew_assignments
  for insert
  to authenticated
  with check (
    organiser_id = (select auth.uid())
    or (select public.is_staff())
  );

drop policy if exists "Assigning host or staff update assignments" on public.event_crew_assignments;
create policy "Assigning host or staff update assignments"
  on public.event_crew_assignments
  for update
  to authenticated
  using (
    organiser_id = (select auth.uid())
    or (select public.is_staff())
  )
  with check (
    organiser_id = (select auth.uid())
    or (select public.is_staff())
  );

drop policy if exists "Crew, assigning host, or staff read assignment events" on public.event_crew_assignment_events;
create policy "Crew, assigning host, or staff read assignment events"
  on public.event_crew_assignment_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_crew_assignments a
      where a.id = assignment_id
        and (
          a.user_id = (select auth.uid())
          or a.organiser_id = (select auth.uid())
          or (select public.is_staff())
        )
    )
  );

drop policy if exists "Host links only their own events" on public.event_crew_assignment_events;
create policy "Host links only their own events"
  on public.event_crew_assignment_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.event_crew_assignments a
      join public.events e on e.id = event_id
      where a.id = assignment_id
        and e.organiser_id = a.organiser_id
        and (
          a.organiser_id = (select auth.uid())
          or (select public.is_staff())
        )
    )
  );

drop policy if exists "Host or staff remove assignment events" on public.event_crew_assignment_events;
create policy "Host or staff remove assignment events"
  on public.event_crew_assignment_events
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.event_crew_assignments a
      where a.id = assignment_id
        and (
          a.organiser_id = (select auth.uid())
          or (select public.is_staff())
        )
    )
  );

drop policy if exists "Crew can read events on a live assignment" on public.events;
create policy "Crew can read events on a live assignment"
  on public.events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_crew_assignment_events ae
      join public.event_crew_assignments a on a.id = ae.assignment_id
      where ae.event_id = events.id
        and a.user_id = (select auth.uid())
        and a.status in ('pending', 'active')
        and a.expires_at > now()
    )
  );

-- ---------------------------------------------------------------------------
-- One permission check for later event RPCs, including direct links.
-- Expired, pending, and revoked rows fail even if a phone still has the screen open.
-- ---------------------------------------------------------------------------

create or replace function public.event_hub_can(p_event_id uuid, p_capability text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner uuid;
  assignment public.event_crew_assignments%rowtype;
begin
  if auth.uid() is null or p_event_id is null then
    return false;
  end if;

  if p_capability not in (
    'view_operations',
    'scan_tickets',
    'view_guest_contacts',
    'send_messages',
    'invite_crew',
    'view_finances',
    'process_refunds',
    'edit_event'
  ) then
    return false;
  end if;

  -- Admin & editor keep the existing override. This is app_metadata, not a crew role.
  if public.is_staff() then
    return true;
  end if;

  select e.organiser_id into owner
  from public.events e
  where e.id = p_event_id;

  if not found then
    return false;
  end if;

  if owner = auth.uid() then
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

  -- Check-in crew: scan & a limited operational view. Flags cannot widen this.
  if assignment.role = 'check_in_crew' then
    return p_capability in ('view_operations', 'scan_tickets');
  end if;

  if p_capability in ('view_operations', 'scan_tickets') then
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

-- Older door collaborators keep contact access when that table exists.
-- The lookup is dynamic so this migration still applies where the table is absent.
create or replace function public.event_hub_legacy_door_contact(p_event_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if to_regclass('public.event_collaborators') is null then
    return false;
  end if;

  execute $sql$
    select exists (
      select 1
      from public.event_collaborators c
      where c.event_id = $1
        and c.user_id = auth.uid()
        and c.access in ('editor', 'door')
    )
  $sql$
  into allowed
  using p_event_id;

  return allowed;
end;
$$;

revoke all on function public.event_hub_legacy_door_contact(uuid) from public, anon, authenticated;

-- Door access already covers the organiser & staff.
-- An active crew grant with scan permission is an extra way in.
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

-- Hide guest email & phone unless this account may view contacts.
-- Door collaborators keep the access they already had.
create or replace function public.list_event_door_guests(p_event_id uuid)
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
  is_scanned boolean,
  occurrence_starts_at timestamptz
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
  if not public.can_manage_event_door(p_event_id) then
    raise exception 'not allowed';
  end if;

  show_contacts := public.event_hub_can(p_event_id, 'view_guest_contacts')
    or public.event_hub_legacy_door_contact(p_event_id);

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
    case
      when show_contacts then coalesce(nullif(trim(t.guest_email), ''), u.email::text)
      else null
    end as guest_email,
    case
      when show_contacts then nullif(trim(t.guest_phone), '')
      else null
    end as guest_phone,
    t.scanned_at,
    t.scanned_by,
    t.created_at as purchased_at,
    (t.scanned_at is not null) as is_scanned,
    t.occurrence_starts_at
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
  show_contacts boolean;
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

  guest_name := nullif(trim(coalesce(ticket.guest_name, '')), '');
  guest_email := nullif(trim(coalesce(ticket.guest_email, '')), '');

  if ticket.buyer_id is not null then
    select
      coalesce(
        guest_name,
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
      coalesce(guest_email, u.email::text)
    into guest_name, guest_email
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = ticket.buyer_id;
  end if;

  show_contacts := public.event_hub_can(p_event_id, 'view_guest_contacts')
    or public.event_hub_legacy_door_contact(p_event_id);
  if not show_contacts then
    guest_email := null;
  end if;

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
