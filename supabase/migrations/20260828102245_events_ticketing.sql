-- Events, ticketing, PayFast orders, organiser payouts, platform fees.
-- Roles stay in auth.users raw_app_meta_data (JWT app_metadata.role).
-- Paid membership remains RevenueCat; this schema only stores ticket money.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.event_status as enum (
    'draft', 'review', 'approved', 'rejected', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.event_visibility as enum ('public', 'private');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ticket_kind as enum ('paid', 'free', 'donation');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.event_order_status as enum (
    'pending', 'paid', 'failed', 'refunded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payout_status as enum (
    'pending', 'owed', 'paid_out', 'waived'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor');
$$;

create or replace function public.slugify(raw text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Platform fee settings (single-row configurable rates)
-- ---------------------------------------------------------------------------

create table if not exists public.platform_fee_settings (
  id int primary key default 1 check (id = 1),
  commission_pct numeric(5, 2) not null default 0
    check (commission_pct >= 0 and commission_pct <= 100),
  booking_fee_cents int not null default 0 check (booking_fee_cents >= 0),
  updated_at timestamptz not null default now()
);

insert into public.platform_fee_settings (id, commission_pct, booking_fee_cents)
values (1, 0, 0)
on conflict (id) do nothing;

alter table public.platform_fee_settings enable row level security;

create policy "Anyone can read platform fee settings"
  on public.platform_fee_settings
  for select
  to anon, authenticated
  using (true);

create policy "Staff can update platform fee settings"
  on public.platform_fee_settings
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  age_restriction text,
  format text,
  category text,
  tags text[] not null default '{}',
  banner_url text,
  listing_image_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Africa/Johannesburg',
  venue_name text not null default '',
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country text not null default 'South Africa',
  latitude double precision,
  longitude double precision,
  show_map boolean not null default false,
  visibility public.event_visibility not null default 'public',
  status public.event_status not null default 'draft',
  organiser_id uuid not null references auth.users (id) on delete restrict,
  created_by uuid not null references auth.users (id) on delete restrict,
  published_by uuid references auth.users (id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);

create index if not exists events_status_starts_idx
  on public.events (status, starts_at);
create index if not exists events_organiser_idx
  on public.events (organiser_id);
create index if not exists events_category_idx
  on public.events (category);

alter table public.events enable row level security;

create policy "Public can read approved public events"
  on public.events
  for select
  to anon, authenticated
  using (
    (status = 'approved' and visibility = 'public')
    or (organiser_id = auth.uid())
    or public.is_staff()
  );

create policy "Signed-in users can create events"
  on public.events
  for insert
  to authenticated
  with check (
    organiser_id = auth.uid()
    and created_by = auth.uid()
    and (
      status in ('draft', 'review')
      or (public.is_staff() and status = 'approved')
    )
  );

create policy "Organisers can update own draft or review events"
  on public.events
  for update
  to authenticated
  using (
    public.is_staff()
    or (organiser_id = auth.uid() and status in ('draft', 'review', 'rejected'))
  )
  with check (
    public.is_staff()
    or (organiser_id = auth.uid() and status in ('draft', 'review', 'rejected'))
  );

create policy "Staff can delete events"
  on public.events
  for delete
  to authenticated
  using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Ticket types
-- ---------------------------------------------------------------------------

create table if not exists public.event_ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  kind public.ticket_kind not null default 'paid',
  price_cents int not null default 0 check (price_cents >= 0),
  member_price_cents int check (member_price_cents is null or member_price_cents >= 0),
  quantity int not null check (quantity >= 0),
  sold_count int not null default 0 check (sold_count >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (sold_count <= quantity)
);

create index if not exists event_ticket_types_event_idx
  on public.event_ticket_types (event_id, sort_order);

alter table public.event_ticket_types enable row level security;

create policy "Read ticket types for visible events"
  on public.event_ticket_types
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and (
          (e.status = 'approved' and e.visibility = 'public')
          or e.organiser_id = auth.uid()
          or public.is_staff()
        )
    )
  );

create policy "Organisers manage ticket types on own events"
  on public.event_ticket_types
  for all
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.events e
      where e.id = event_id
        and e.organiser_id = auth.uid()
        and e.status in ('draft', 'review', 'rejected')
    )
  )
  with check (
    public.is_staff()
    or exists (
      select 1 from public.events e
      where e.id = event_id
        and e.organiser_id = auth.uid()
        and e.status in ('draft', 'review', 'rejected')
    )
  );

-- ---------------------------------------------------------------------------
-- Organiser payout profiles
-- ---------------------------------------------------------------------------

create table if not exists public.organiser_payout_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  account_holder text not null,
  bank_name text not null,
  account_number_last4 text not null,
  account_number_enc text not null,
  branch_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organiser_payout_profiles enable row level security;

create policy "Owner or staff can read payout profile"
  on public.organiser_payout_profiles
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy "Owner can upsert payout profile"
  on public.organiser_payout_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Owner can update payout profile"
  on public.organiser_payout_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Orders & tickets
-- ---------------------------------------------------------------------------

create table if not exists public.event_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  status public.event_order_status not null default 'pending',
  subtotal_cents int not null default 0 check (subtotal_cents >= 0),
  member_discount_cents int not null default 0 check (member_discount_cents >= 0),
  commission_cents int not null default 0 check (commission_cents >= 0),
  booking_fee_cents int not null default 0 check (booking_fee_cents >= 0),
  total_cents int not null default 0 check (total_cents >= 0),
  used_member_pricing boolean not null default false,
  payfast_payment_id text,
  payfast_token text,
  m_payment_id text unique,
  payout_status public.payout_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists event_orders_buyer_idx on public.event_orders (buyer_id);
create index if not exists event_orders_event_idx on public.event_orders (event_id);
create index if not exists event_orders_status_idx on public.event_orders (status);

alter table public.event_orders enable row level security;

create policy "Buyers and organisers and staff read orders"
  on public.event_orders
  for select
  to authenticated
  using (
    buyer_id = auth.uid()
    or public.is_staff()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organiser_id = auth.uid()
    )
  );

create policy "Buyers can create pending orders"
  on public.event_orders
  for insert
  to authenticated
  with check (buyer_id = auth.uid() and status = 'pending');

-- Updates to paid status happen via service role / privileged functions.

create table if not exists public.event_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.event_orders (id) on delete cascade,
  ticket_type_id uuid not null references public.event_ticket_types (id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  line_total_cents int not null check (line_total_cents >= 0)
);

alter table public.event_order_items enable row level security;

create policy "Read order items with order access"
  on public.event_order_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.event_orders o
      where o.id = order_id
        and (
          o.buyer_id = auth.uid()
          or public.is_staff()
          or exists (
            select 1 from public.events e
            where e.id = o.event_id and e.organiser_id = auth.uid()
          )
        )
    )
  );

create policy "Buyers insert items on own pending orders"
  on public.event_order_items
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.event_orders o
      where o.id = order_id
        and o.buyer_id = auth.uid()
        and o.status = 'pending'
    )
  );

create table if not exists public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.event_orders (id) on delete cascade,
  ticket_type_id uuid not null references public.event_ticket_types (id) on delete restrict,
  event_id uuid not null references public.events (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists event_tickets_buyer_idx on public.event_tickets (buyer_id);
create index if not exists event_tickets_event_idx on public.event_tickets (event_id);

alter table public.event_tickets enable row level security;

create policy "Buyers organisers staff read tickets"
  on public.event_tickets
  for select
  to authenticated
  using (
    buyer_id = auth.uid()
    or public.is_staff()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organiser_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Event audit
-- ---------------------------------------------------------------------------

create table if not exists public.event_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  actor_id uuid not null,
  action text not null,
  from_status public.event_status,
  to_status public.event_status,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

alter table public.event_audit_events enable row level security;

create policy "Staff can read event audit"
  on public.event_audit_events
  for select
  to authenticated
  using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Privileged helpers
-- ---------------------------------------------------------------------------

create or replace function public.ensure_member_role(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if auth.uid() is distinct from target and not public.is_staff() then
    raise exception 'not allowed';
  end if;

  select coalesce(raw_app_meta_data ->> 'role', '')
    into current_role
  from auth.users
  where id = target;

  if current_role = '' then
    update auth.users
    set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'member')
    where id = target;
  end if;

  begin
    insert into public.profiles (id, onboarding_step, onboarding_version)
    values (target, 'welcome', 1)
    on conflict (id) do nothing;
  exception
    when undefined_column then
      insert into public.profiles (id)
      values (target)
      on conflict (id) do nothing;
  end;
end;
$$;

revoke all on function public.ensure_member_role(uuid) from public;
grant execute on function public.ensure_member_role(uuid) to authenticated, service_role;

create or replace function public.admin_apply_event_action(
  p_event_id uuid,
  p_action text,
  p_note text default null
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.events;
  prev_status public.event_status;
  next_status public.event_status;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select * into row from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event not found';
  end if;

  prev_status := row.status;

  if p_action = 'approve' then
    next_status := 'approved';
  elsif p_action = 'reject' then
    next_status := 'rejected';
  elsif p_action = 'cancel' then
    next_status := 'cancelled';
  elsif p_action = 'request_changes' then
    next_status := 'draft';
  else
    raise exception 'unknown action';
  end if;

  update public.events
  set
    status = next_status,
    review_note = p_note,
    published_by = case when next_status = 'approved' then actor else published_by end,
    updated_at = now()
  where id = p_event_id
  returning * into row;

  insert into public.event_audit_events (
    event_id, actor_id, action, from_status, to_status, after
  ) values (
    p_event_id, actor, p_action, prev_status, next_status,
    jsonb_build_object('note', p_note)
  );

  return row;
end;
$$;

revoke all on function public.admin_apply_event_action(uuid, text, text) from public;
grant execute on function public.admin_apply_event_action(uuid, text, text) to authenticated, service_role;

create or replace function public.fulfil_event_order(p_order_id uuid, p_payment_id text default null)
returns public.event_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.event_orders;
  item record;
  i int;
  ticket_code text;
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

  for item in
    select * from public.event_order_items where order_id = p_order_id
  loop
    update public.event_ticket_types
    set sold_count = sold_count + item.quantity
    where id = item.ticket_type_id
      and sold_count + item.quantity <= quantity;

    if not found then
      raise exception 'not enough tickets for %', item.ticket_type_id;
    end if;

    for i in 1..item.quantity loop
      ticket_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
      insert into public.event_tickets (
        order_id, ticket_type_id, event_id, buyer_id, code
      ) values (
        p_order_id, item.ticket_type_id, ord.event_id, ord.buyer_id, ticket_code
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

  return ord;
end;
$$;

revoke all on function public.fulfil_event_order(uuid, text) from public;
grant execute on function public.fulfill_event_order(uuid, text) to service_role;

-- Storage bucket for event images (public read).
insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

create policy "Public read event media"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'event-media');

create policy "Authenticated upload event media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'event-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners update own event media"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'event-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners delete own event media"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'event-media' and (storage.foldername(name))[1] = auth.uid()::text);
