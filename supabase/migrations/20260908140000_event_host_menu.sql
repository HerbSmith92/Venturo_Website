-- Event Host Menu: collaborators, marketing, comps, host actions, live edits.

-- ---------------------------------------------------------------------------
-- Ticket guest identity (comps / RSVP)
-- ---------------------------------------------------------------------------

alter table public.event_tickets
  alter column buyer_id drop not null;

alter table public.event_tickets
  add column if not exists guest_name text,
  add column if not exists guest_email text,
  add column if not exists guest_phone text;

alter table public.events
  add column if not exists refund_intent text
    check (refund_intent is null or refund_intent in ('none', 'requested'));

alter table public.event_orders
  add column if not exists campaign_id uuid,
  add column if not exists promo_code_id uuid;

-- ---------------------------------------------------------------------------
-- Collaborators (event-level, not app_metadata roles)
-- ---------------------------------------------------------------------------

create table if not exists public.event_collaborators (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  access text not null check (access in ('editor', 'door')),
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

create index if not exists event_collaborators_user_idx
  on public.event_collaborators (user_id);

alter table public.event_collaborators enable row level security;

-- ---------------------------------------------------------------------------
-- Marketing
-- ---------------------------------------------------------------------------

create table if not exists public.event_promoter_networks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.event_promoters (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  network_id uuid references public.event_promoter_networks (id) on delete set null,
  name text not null,
  email text not null,
  incentive_pct numeric(5, 2) not null default 0
    check (incentive_pct >= 0 and incentive_pct <= 100),
  created_at timestamptz not null default now()
);

create table if not exists public.event_promo_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  promoter_id uuid references public.event_promoters (id) on delete set null,
  network_id uuid references public.event_promoter_networks (id) on delete set null,
  code text not null,
  kind text not null check (kind in ('percent', 'amount', 'hidden_ticket')),
  value numeric(10, 2),
  hidden_ticket_type_id uuid references public.event_ticket_types (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, code)
);

create table if not exists public.event_campaigns (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (event_id, slug)
);

create table if not exists public.event_campaign_hits (
  campaign_id uuid not null references public.event_campaigns (id) on delete cascade,
  day date not null,
  views int not null default 0 check (views >= 0),
  primary key (campaign_id, day)
);

create table if not exists public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('invite', 'rsvp')),
  email text not null,
  name text not null default '',
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  ticket_id uuid references public.event_tickets (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.event_invites
  add column if not exists kind text,
  add column if not exists ticket_id uuid references public.event_tickets (id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'event_invites'
      and column_name = 'complimentary'
  ) then
    update public.event_invites
      set kind = case when coalesce(complimentary, false) then 'rsvp' else 'invite' end
      where kind is null;
  else
    update public.event_invites set kind = 'invite' where kind is null;
  end if;
end $$;

alter table public.event_invites alter column kind set default 'invite';
update public.event_invites set kind = 'invite' where kind is null;
alter table public.event_invites alter column kind set not null;

alter table public.event_invites drop constraint if exists event_invites_kind_check;
alter table public.event_invites
  add constraint event_invites_kind_check check (kind in ('invite', 'rsvp'));

alter table public.event_invites drop constraint if exists event_invites_status_check;
alter table public.event_invites
  add constraint event_invites_status_check
  check (status in ('pending', 'opened', 'booked', 'claimed', 'accepted', 'revoked'));

alter table public.event_promo_codes
  add column if not exists value numeric(10, 2),
  add column if not exists promoter_id uuid,
  add column if not exists network_id uuid references public.event_promoter_networks (id) on delete set null,
  add column if not exists hidden_ticket_type_id uuid references public.event_ticket_types (id) on delete set null;

alter table public.event_promoter_networks enable row level security;
alter table public.event_promoters enable row level security;
alter table public.event_promo_codes enable row level security;
alter table public.event_campaigns enable row level security;
alter table public.event_campaign_hits enable row level security;
alter table public.event_invites enable row level security;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

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
      and (
        e.organiser_id = auth.uid()
        or public.is_staff()
        or exists (
          select 1
          from public.event_collaborators c
          where c.event_id = e.id
            and c.user_id = auth.uid()
            and c.access = 'editor'
        )
      )
  );
$$;

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
        or exists (
          select 1
          from public.event_collaborators c
          where c.event_id = e.id
            and c.user_id = auth.uid()
            and c.access in ('editor', 'door')
        )
      )
  );
$$;

revoke all on function public.can_manage_event(uuid) from public;
grant execute on function public.can_manage_event(uuid) to authenticated, service_role;
revoke all on function public.can_manage_event_door(uuid) from public;
grant execute on function public.can_manage_event_door(uuid) to authenticated, service_role;

create policy "Collaborators can read events"
  on public.events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.event_collaborators c
      where c.event_id = id and c.user_id = auth.uid()
    )
  );

create policy "Managers read collaborators"
  on public.event_collaborators
  for select
  to authenticated
  using (public.can_manage_event_door(event_id) or user_id = auth.uid());

create policy "Owners manage collaborators"
  on public.event_collaborators
  for all
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organiser_id = auth.uid()
    )
  )
  with check (
    public.is_staff()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organiser_id = auth.uid()
    )
  );

create policy "Managers read promoter networks"
  on public.event_promoter_networks for select to authenticated
  using (public.can_manage_event(event_id));
create policy "Managers write promoter networks"
  on public.event_promoter_networks for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

create policy "Managers read promoters"
  on public.event_promoters for select to authenticated
  using (public.can_manage_event(event_id));
create policy "Managers write promoters"
  on public.event_promoters for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

create policy "Managers read promo codes"
  on public.event_promo_codes for select to authenticated
  using (public.can_manage_event(event_id));
create policy "Managers write promo codes"
  on public.event_promo_codes for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

create policy "Managers read campaigns"
  on public.event_campaigns for select to authenticated
  using (public.can_manage_event(event_id));
create policy "Managers write campaigns"
  on public.event_campaigns for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

create policy "Managers read campaign hits"
  on public.event_campaign_hits for select to authenticated
  using (
    exists (
      select 1 from public.event_campaigns c
      where c.id = campaign_id and public.can_manage_event(c.event_id)
    )
  );

create policy "Managers read invites"
  on public.event_invites for select to authenticated
  using (public.can_manage_event(event_id));
create policy "Managers write invites"
  on public.event_invites for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

-- Public can read a pending invite by token via RPC only.

-- ---------------------------------------------------------------------------
-- Door list includes guest_* columns
-- ---------------------------------------------------------------------------

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
            nullif(trim(coalesce(p.display_name, p.first_name, '')), ''),
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
    lower(coalesce(t.guest_name, p.display_name, p.first_name, u.email, t.code)),
    t.created_at;
end;
$$;

revoke all on function public.list_event_door_guests(uuid) from public;
grant execute on function public.list_event_door_guests(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Host actions
-- ---------------------------------------------------------------------------

create or replace function public.host_copy_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  src public.events%rowtype;
  new_id uuid;
  new_slug text;
  ticket public.event_ticket_types%rowtype;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not public.can_manage_event(p_event_id) then raise exception 'not allowed'; end if;

  select * into src from public.events where id = p_event_id;
  if not found then raise exception 'event not found'; end if;

  new_slug := public.slugify(src.title) || '-copy';
  if exists (select 1 from public.events where slug = new_slug) then
    new_slug := new_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into public.events (
    slug, title, description, age_restriction, format, category, tags,
    banner_url, listing_image_url, story_image_url, starts_at, ends_at, timezone,
    venue_name, address_line1, address_line2, city, postal_code, country,
    latitude, longitude, show_map, visibility, parking, prohibited_items,
    audience_gender, status, organiser_id, created_by
  )
  values (
    new_slug, src.title || ' (copy)', src.description, src.age_restriction, src.format,
    src.category, src.tags, src.banner_url, src.listing_image_url, src.story_image_url,
    src.starts_at, src.ends_at, src.timezone, src.venue_name, src.address_line1,
    src.address_line2, src.city, src.postal_code, src.country, src.latitude, src.longitude,
    src.show_map, src.visibility, src.parking, src.prohibited_items, src.audience_gender,
    'draft', src.organiser_id, actor
  )
  returning id into new_id;

  for ticket in
    select * from public.event_ticket_types where event_id = p_event_id order by sort_order
  loop
    insert into public.event_ticket_types (
      event_id, name, kind, price_cents, member_price_cents, member_discount_kind,
      member_discount_value, members_only, pass_fees_to_buyer, pass_commission_to_buyer,
      quantity, sold_count, sort_order
    ) values (
      new_id, ticket.name, ticket.kind, ticket.price_cents, ticket.member_price_cents,
      ticket.member_discount_kind, ticket.member_discount_value, ticket.members_only,
      ticket.pass_fees_to_buyer, ticket.pass_commission_to_buyer, ticket.quantity, 0,
      ticket.sort_order
    );
  end loop;

  insert into public.event_audit_events (event_id, actor_id, action, after)
  values (new_id, actor, 'copy', jsonb_build_object('from', p_event_id));

  return jsonb_build_object('id', new_id, 'slug', new_slug);
end;
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
    refund_intent = case when p_refund_intent = 'requested' then 'requested' else coalesce(refund_intent, 'none') end,
    updated_at = now()
  where id = p_event_id
  returning * into row;

  insert into public.event_audit_events (event_id, actor_id, action, after)
  values (
    p_event_id, actor, 'postpone',
    jsonb_build_object('starts_at', p_starts_at, 'ends_at', p_ends_at, 'refund_intent', p_refund_intent)
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
    refund_intent = case when p_refund_intent = 'requested' then 'requested' else coalesce(refund_intent, 'none') end,
    updated_at = now()
  where id = p_event_id
  returning * into row;

  insert into public.event_audit_events (event_id, actor_id, action, from_status, to_status, after)
  values (
    p_event_id, actor, 'cancel', prev, 'cancelled',
    jsonb_build_object('refund_intent', p_refund_intent)
  );
  return row;
end;
$$;

create or replace function public.host_issue_comp(
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_name text,
  p_email text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  ticket_code text;
  order_id uuid;
  ticket_id uuid;
  tt public.event_ticket_types%rowtype;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not public.can_manage_event(p_event_id) then raise exception 'not allowed'; end if;

  select * into tt from public.event_ticket_types
  where id = p_ticket_type_id and event_id = p_event_id;
  if not found then raise exception 'ticket type not found'; end if;

  update public.event_ticket_types
  set sold_count = sold_count + 1
  where id = tt.id and sold_count + 1 <= quantity;
  if not found then raise exception 'No tickets left on that type.'; end if;

  insert into public.event_orders (
    event_id, buyer_id, status, subtotal_cents, member_discount_cents,
    commission_cents, booking_fee_cents, total_cents, used_member_pricing,
    payout_status
  ) values (
    p_event_id, actor, 'paid', 0, 0, 0, 0, 0, false, 'waived'
  )
  returning id into order_id;

  insert into public.event_order_items (
    order_id, ticket_type_id, quantity, unit_price_cents, line_total_cents
  ) values (order_id, tt.id, 1, 0, 0);

  ticket_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
  insert into public.event_tickets (
    order_id, ticket_type_id, event_id, buyer_id, code, guest_name, guest_email, guest_phone
  ) values (
    order_id, tt.id, p_event_id, null, ticket_code,
    nullif(trim(p_name), ''), nullif(trim(p_email), ''), nullif(trim(p_phone), '')
  )
  returning id into ticket_id;

  insert into public.event_audit_events (event_id, actor_id, action, after)
  values (
    p_event_id, actor, 'comp',
    jsonb_build_object('ticket_id', ticket_id, 'email', p_email)
  );

  return jsonb_build_object('ticketId', ticket_id, 'code', ticket_code, 'orderId', order_id);
end;
$$;

create or replace function public.host_update_live_event(p_event_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  ticket jsonb;
  ticket_id uuid;
  sold int;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not public.can_manage_event(p_event_id) then raise exception 'not allowed'; end if;

  update public.events
  set
    title = coalesce(p_payload->>'title', title),
    description = coalesce(p_payload->>'description', description),
    age_restriction = p_payload->>'age_restriction',
    audience_gender = coalesce(p_payload->>'audience_gender', audience_gender),
    format = p_payload->>'format',
    category = p_payload->>'category',
    tags = coalesce(array(select jsonb_array_elements_text(p_payload->'tags')), tags),
    banner_url = p_payload->>'banner_url',
    listing_image_url = p_payload->>'listing_image_url',
    story_image_url = p_payload->>'story_image_url',
    starts_at = coalesce((p_payload->>'starts_at')::timestamptz, starts_at),
    ends_at = coalesce((p_payload->>'ends_at')::timestamptz, ends_at),
    timezone = coalesce(p_payload->>'timezone', timezone),
    venue_name = coalesce(p_payload->>'venue_name', venue_name),
    address_line1 = p_payload->>'address_line1',
    address_line2 = p_payload->>'address_line2',
    city = p_payload->>'city',
    postal_code = p_payload->>'postal_code',
    country = coalesce(p_payload->>'country', country),
    latitude = nullif(p_payload->>'latitude', '')::double precision,
    longitude = nullif(p_payload->>'longitude', '')::double precision,
    show_map = coalesce((p_payload->>'show_map')::boolean, show_map),
    visibility = coalesce((p_payload->>'visibility')::public.event_visibility, visibility),
    prohibited_items = p_payload->>'prohibited_items',
    updated_at = now()
  where id = p_event_id;

  if p_payload ? 'ticket_types' and jsonb_typeof(p_payload->'ticket_types') = 'array' then
    for ticket in select * from jsonb_array_elements(p_payload->'ticket_types')
    loop
      ticket_id := nullif(ticket->>'id', '')::uuid;
      if ticket_id is not null then
        select sold_count into sold from public.event_ticket_types
        where id = ticket_id and event_id = p_event_id;
        if not found then continue; end if;
        update public.event_ticket_types
        set
          name = coalesce(nullif(trim(ticket->>'name'), ''), name),
          quantity = greatest(sold, coalesce((ticket->>'quantity')::int, quantity)),
          price_cents = coalesce((ticket->>'priceCents')::int, price_cents),
          member_price_cents = (ticket->>'memberPriceCents')::int,
          member_discount_kind = coalesce(ticket->>'memberDiscountKind', member_discount_kind),
          member_discount_value = (ticket->>'memberDiscountValue')::numeric,
          members_only = coalesce((ticket->>'membersOnly')::boolean, members_only),
          pass_fees_to_buyer = coalesce((ticket->>'passFeesToBuyer')::boolean, pass_fees_to_buyer),
          pass_commission_to_buyer = coalesce((ticket->>'passCommissionToBuyer')::boolean, pass_commission_to_buyer)
        where id = ticket_id;
      else
        insert into public.event_ticket_types (
          event_id, name, kind, price_cents, member_price_cents, member_discount_kind,
          member_discount_value, members_only, pass_fees_to_buyer, pass_commission_to_buyer,
          quantity, sort_order
        ) values (
          p_event_id,
          coalesce(nullif(trim(ticket->>'name'), ''), 'Ticket'),
          coalesce((ticket->>'kind')::public.ticket_kind, 'paid'),
          coalesce((ticket->>'priceCents')::int, 0),
          (ticket->>'memberPriceCents')::int,
          coalesce(ticket->>'memberDiscountKind', 'none'),
          (ticket->>'memberDiscountValue')::numeric,
          coalesce((ticket->>'membersOnly')::boolean, false),
          coalesce((ticket->>'passFeesToBuyer')::boolean, false),
          coalesce((ticket->>'passCommissionToBuyer')::boolean, false),
          coalesce((ticket->>'quantity')::int, 0),
          100
        );
      end if;
    end loop;
  end if;

  insert into public.event_audit_events (event_id, actor_id, action, after)
  values (p_event_id, actor, 'live_update', p_payload);
end;
$$;

create or replace function public.accept_event_invite(p_token text, p_name text default null, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.event_invites%rowtype;
  ticket_type uuid;
  result jsonb;
begin
  select * into invite from public.event_invites where token = p_token for update;
  if not found then raise exception 'Invite not found.'; end if;
  if invite.status <> 'pending' then raise exception 'This invite is already used.'; end if;

  select id into ticket_type
  from public.event_ticket_types
  where event_id = invite.event_id
  order by case when kind = 'free' then 0 else 1 end, sort_order
  limit 1;
  if ticket_type is null then raise exception 'No ticket types on that event.'; end if;

  -- Issue as the organiser so inventory moves even when the guest is anonymous.
  result := public.host_issue_comp_as_system(
    invite.event_id,
    ticket_type,
    coalesce(nullif(trim(p_name), ''), invite.name, 'Guest'),
    invite.email,
    p_phone
  );

  update public.event_invites
  set status = 'accepted', ticket_id = (result->>'ticketId')::uuid
  where id = invite.id;

  return result;
end;
$$;

create or replace function public.host_issue_comp_as_system(
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_name text,
  p_email text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_code text;
  order_id uuid;
  ticket_id uuid;
  organiser uuid;
  tt public.event_ticket_types%rowtype;
begin
  select organiser_id into organiser from public.events where id = p_event_id;
  if organiser is null then raise exception 'event not found'; end if;

  select * into tt from public.event_ticket_types
  where id = p_ticket_type_id and event_id = p_event_id;
  if not found then raise exception 'ticket type not found'; end if;

  update public.event_ticket_types
  set sold_count = sold_count + 1
  where id = tt.id and sold_count + 1 <= quantity;
  if not found then raise exception 'No tickets left on that type.'; end if;

  insert into public.event_orders (
    event_id, buyer_id, status, subtotal_cents, member_discount_cents,
    commission_cents, booking_fee_cents, total_cents, used_member_pricing,
    payout_status
  ) values (
    p_event_id, organiser, 'paid', 0, 0, 0, 0, 0, false, 'waived'
  )
  returning id into order_id;

  insert into public.event_order_items (
    order_id, ticket_type_id, quantity, unit_price_cents, line_total_cents
  ) values (order_id, tt.id, 1, 0, 0);

  ticket_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
  insert into public.event_tickets (
    order_id, ticket_type_id, event_id, buyer_id, code, guest_name, guest_email, guest_phone
  ) values (
    order_id, tt.id, p_event_id, null, ticket_code,
    nullif(trim(p_name), ''), nullif(trim(p_email), ''), nullif(trim(p_phone), '')
  )
  returning id into ticket_id;

  return jsonb_build_object('ticketId', ticket_id, 'code', ticket_code, 'orderId', order_id);
end;
$$;

create or replace function public.get_event_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  invite public.event_invites%rowtype;
  evt public.events%rowtype;
begin
  select * into invite from public.event_invites where token = p_token;
  if not found then return null; end if;
  select * into evt from public.events where id = invite.event_id;
  return jsonb_build_object(
    'kind', invite.kind,
    'status', invite.status,
    'email', invite.email,
    'name', invite.name,
    'eventTitle', evt.title,
    'eventSlug', evt.slug,
    'startsAt', evt.starts_at
  );
end;
$$;

revoke all on function public.host_copy_event(uuid) from public;
grant execute on function public.host_copy_event(uuid) to authenticated, service_role;
revoke all on function public.host_postpone_event(uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.host_postpone_event(uuid, timestamptz, timestamptz, text) to authenticated, service_role;
revoke all on function public.host_cancel_event(uuid, text) from public;
grant execute on function public.host_cancel_event(uuid, text) to authenticated, service_role;
revoke all on function public.host_issue_comp(uuid, uuid, text, text, text) from public;
grant execute on function public.host_issue_comp(uuid, uuid, text, text, text) to authenticated, service_role;
revoke all on function public.host_update_live_event(uuid, jsonb) from public;
grant execute on function public.host_update_live_event(uuid, jsonb) to authenticated, service_role;
revoke all on function public.host_issue_comp_as_system(uuid, uuid, text, text, text) from public;
grant execute on function public.host_issue_comp_as_system(uuid, uuid, text, text, text) to service_role;
revoke all on function public.accept_event_invite(text, text, text) from public;
grant execute on function public.accept_event_invite(text, text, text) to anon, authenticated, service_role;
revoke all on function public.get_event_invite(text) from public;
grant execute on function public.get_event_invite(text) to anon, authenticated, service_role;
