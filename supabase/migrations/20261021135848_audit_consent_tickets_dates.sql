-- Public ticket visibility, the booked occurrence, and stored policy consent.

alter table public.event_ticket_types
  add column if not exists listed boolean not null default true;

comment on column public.event_ticket_types.listed is
  'When false, the ticket stays off public discovery and checkout.';

alter table public.event_orders
  add column if not exists occurrence_starts_at timestamptz,
  add column if not exists occurrence_ends_at timestamptz;

alter table public.event_tickets
  add column if not exists occurrence_starts_at timestamptz,
  add column if not exists occurrence_ends_at timestamptz;

create index if not exists event_tickets_occurrence_idx
  on public.event_tickets (ticket_type_id, occurrence_starts_at);

create table if not exists public.member_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  policy text not null check (policy in ('terms', 'privacy')),
  version text not null,
  source text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, policy, version)
);

alter table public.member_consents enable row level security;

drop policy if exists member_consents_read on public.member_consents;
create policy member_consents_read
  on public.member_consents
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

revoke all on table public.member_consents from public, anon, authenticated;
grant select on table public.member_consents to authenticated;

create or replace function public.fulfill_event_order(p_order_id uuid, p_payment_id text default null)
returns public.event_orders
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ord public.event_orders;
  item record;
  i int;
  ticket_code text;
  taken int;
  cap int;
begin
  select * into ord from public.event_orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;

  if ord.status = 'paid' then
    return ord;
  end if;

  if ord.status <> 'pending' then
    raise exception 'order not pending';
  end if;

  if ord.promo_code_id is not null then
    update public.event_promo_codes
    set redeemed_count = redeemed_count + 1
    where id = ord.promo_code_id
      and active = true
      and (max_redemptions is null or redeemed_count < max_redemptions);

    if not found then
      raise exception 'promo code is no longer valid';
    end if;
  end if;

  for item in
    select * from public.event_order_items where order_id = p_order_id
  loop
    if ord.occurrence_starts_at is not null then
      select quantity into cap
      from public.event_ticket_types
      where id = item.ticket_type_id
      for update;

      if cap is null then
        raise exception 'not enough tickets for %', item.ticket_type_id;
      end if;

      select count(*) into taken
      from public.event_tickets
      where ticket_type_id = item.ticket_type_id
        and occurrence_starts_at = ord.occurrence_starts_at;

      if taken + item.quantity > cap then
        raise exception 'not enough tickets for %', item.ticket_type_id;
      end if;
    else
      update public.event_ticket_types
      set sold_count = sold_count + item.quantity
      where id = item.ticket_type_id
        and sold_count + item.quantity <= quantity;

      if not found then
        raise exception 'not enough tickets for %', item.ticket_type_id;
      end if;
    end if;

    for i in 1..item.quantity loop
      ticket_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
      insert into public.event_tickets (
        order_id, ticket_type_id, event_id, buyer_id, code,
        guest_name, guest_email, guest_phone, origin, invite_id,
        occurrence_starts_at, occurrence_ends_at
      ) values (
        p_order_id, item.ticket_type_id, ord.event_id, ord.buyer_id, ticket_code,
        ord.buyer_name, ord.buyer_email, ord.buyer_phone,
        case when ord.source = 'complimentary' then 'complimentary'
             when ord.invite_id is not null then 'invite'
             else 'purchase' end,
        ord.invite_id,
        ord.occurrence_starts_at, ord.occurrence_ends_at
      );
    end loop;
  end loop;

  update public.event_orders
  set
    status = 'paid',
    payfast_payment_id = coalesce(p_payment_id, payfast_payment_id),
    paid_at = now(),
    payout_status = case when total_cents > 0 then 'owed'::public.payout_status else 'waived'::public.payout_status end,
    updated_at = now()
  where id = p_order_id
  returning * into ord;

  if ord.invite_id is not null then
    update public.event_invites
    set
      status = case when complimentary then 'claimed' else 'booked' end,
      booked_at = coalesce(booked_at, now()),
      claimed_at = case when complimentary then now() else claimed_at end
    where id = ord.invite_id
      and status in ('pending', 'opened', 'booked');
  end if;

  return ord;
end;
$$;

revoke all on function public.fulfill_event_order(uuid, text) from public;
grant execute on function public.fulfill_event_order(uuid, text) to service_role;

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
  is_scanned boolean,
  occurrence_starts_at timestamptz
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
