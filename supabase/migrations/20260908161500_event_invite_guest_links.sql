-- Public invite landing: guests can open a unique link without being the host.
-- Marketing invites mark opened, then booked when checkout fulfils the order.
-- RSVP / complimentary invites mint a ticket on accept.

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
  if p_token is null or length(trim(p_token)) < 8 then
    return null;
  end if;

  select * into invite from public.event_invites where token = p_token;
  if not found then
    return null;
  end if;

  select * into evt from public.events where id = invite.event_id;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'kind', invite.kind,
    'status', invite.status,
    'email', invite.email,
    'name', coalesce(invite.name, ''),
    'complimentary', invite.complimentary,
    'eventTitle', evt.title,
    'eventSlug', evt.slug,
    'startsAt', evt.starts_at,
    'endsAt', evt.ends_at,
    'venueName', evt.venue_name,
    'city', evt.city,
    'timezone', evt.timezone
  );
end;
$$;

create or replace function public.open_event_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_invites
  set
    status = 'opened',
    opened_at = coalesce(opened_at, now())
  where token = p_token
    and status = 'pending';

  return public.get_event_invite(p_token);
end;
$$;

create or replace function public.accept_event_invite(
  p_token text,
  p_name text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.event_invites%rowtype;
  ticket public.event_ticket_types%rowtype;
  guest_name text;
  guest_email text;
  guest_phone text;
  ticket_code text;
  order_id uuid;
  ticket_id uuid;
  qty int;
begin
  select * into invite from public.event_invites where token = p_token for update;
  if not found then
    raise exception 'Invite not found.';
  end if;

  if invite.status in ('booked', 'claimed', 'accepted') then
    raise exception 'This invite is already used.';
  end if;
  if invite.status = 'revoked' then
    raise exception 'This invite is no longer valid.';
  end if;

  if not invite.complimentary and invite.kind <> 'rsvp' then
    update public.event_invites
    set
      status = 'opened',
      opened_at = coalesce(opened_at, now())
    where id = invite.id
      and status = 'pending';
    return jsonb_build_object('kind', 'book', 'eventSlug', (
      select slug from public.events where id = invite.event_id
    ));
  end if;

  guest_name := coalesce(nullif(trim(p_name), ''), nullif(trim(invite.name), ''), 'Guest');
  guest_email := lower(trim(invite.email));
  guest_phone := nullif(trim(coalesce(p_phone, '')), '');
  qty := greatest(coalesce(invite.quantity, 1), 1);

  if invite.ticket_type_id is not null then
    select * into ticket
    from public.event_ticket_types
    where id = invite.ticket_type_id and event_id = invite.event_id;
  end if;

  if ticket.id is null then
    select * into ticket
    from public.event_ticket_types
    where event_id = invite.event_id
    order by case when kind = 'free' then 0 else 1 end, sort_order
    limit 1;
  end if;

  if ticket.id is null then
    raise exception 'No ticket types on that event.';
  end if;

  update public.event_ticket_types
  set sold_count = sold_count + qty
  where id = ticket.id
    and sold_count + qty <= quantity;
  if not found then
    raise exception 'No tickets left on that type.';
  end if;

  insert into public.event_orders (
    event_id, buyer_id, status,
    subtotal_cents, member_discount_cents, commission_cents, booking_fee_cents, total_cents,
    used_member_pricing, payout_status, paid_at,
    buyer_email, buyer_name, buyer_phone, source, invite_id
  ) values (
    invite.event_id, null, 'paid',
    0, 0, 0, 0, 0,
    false, 'waived', now(),
    guest_email, guest_name, guest_phone,
    'complimentary', invite.id
  )
  returning id into order_id;

  insert into public.event_order_items (
    order_id, ticket_type_id, quantity, unit_price_cents, line_total_cents
  ) values (
    order_id, ticket.id, qty, 0, 0
  );

  ticket_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
  insert into public.event_tickets (
    order_id, ticket_type_id, event_id, buyer_id, code,
    guest_name, guest_email, guest_phone, origin, invite_id
  ) values (
    order_id, ticket.id, invite.event_id, null, ticket_code,
    guest_name, guest_email, guest_phone, 'complimentary', invite.id
  )
  returning id into ticket_id;

  update public.event_invites
  set
    status = 'claimed',
    ticket_id = ticket_id,
    claimed_at = coalesce(claimed_at, now()),
    booked_at = coalesce(booked_at, now()),
    opened_at = coalesce(opened_at, now())
  where id = invite.id;

  return jsonb_build_object('kind', 'claimed', 'code', ticket_code, 'ticketId', ticket_id);
end;
$$;

revoke all on function public.get_event_invite(text) from public;
grant execute on function public.get_event_invite(text) to anon, authenticated, service_role;
revoke all on function public.open_event_invite(text) from public;
grant execute on function public.open_event_invite(text) to anon, authenticated, service_role;
revoke all on function public.accept_event_invite(text, text, text) from public;
grant execute on function public.accept_event_invite(text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
