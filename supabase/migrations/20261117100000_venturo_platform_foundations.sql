-- Shared foundations for occurrence booking, durable notifications, reports,
-- privacy-preserving analytics and community management.

alter table public.organiser_payout_profiles
  add column if not exists encryption_version integer not null default 0,
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  add column if not exists verification_reference text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users (id) on delete set null,
  add column if not exists changed_at timestamptz not null default now();

alter table public.events
  add column if not exists booking_method text not null default 'venturo_ticketing'
    check (booking_method in ('free_rsvp', 'venturo_ticketing', 'external')),
  add column if not exists external_provider_name text,
  add column if not exists external_booking_url text,
  add column if not exists external_booking_verified_at timestamptz,
  add column if not exists host_report_local_time time not null default '07:00',
  add column if not exists waitlist_enabled boolean not null default false;

alter table public.events
  drop constraint if exists events_external_booking_fields_check;
alter table public.events
  add constraint events_external_booking_fields_check check (
    (booking_method <> 'external')
    or (
      nullif(btrim(external_provider_name), '') is not null
      and external_booking_url ~* '^https://'
    )
  );

create table if not exists public.event_occurrences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Africa/Johannesburg',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'rescheduled', 'cancelled', 'ended')),
  previous_starts_at timestamptz,
  previous_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, starts_at)
);

create index if not exists event_occurrences_due_idx
  on public.event_occurrences (starts_at, status);

insert into public.event_occurrences (event_id, starts_at, ends_at, timezone)
select id, starts_at, ends_at, coalesce(nullif(timezone, ''), 'Africa/Johannesburg')
from public.events
where starts_at is not null
on conflict (event_id, starts_at) do nothing;

alter table public.event_orders
  add column if not exists occurrence_id uuid references public.event_occurrences (id) on delete restrict,
  add column if not exists booking_source text not null default 'venturo_ticketing'
    check (booking_source in ('free_rsvp', 'venturo_ticketing', 'complimentary', 'invite'));

alter table public.event_tickets
  add column if not exists occurrence_id uuid references public.event_occurrences (id) on delete restrict;

create unique index if not exists event_orders_one_free_rsvp_idx
  on public.event_orders (buyer_id, event_id, occurrence_id)
  where booking_source = 'free_rsvp' and status in ('pending', 'paid');

update public.event_orders o
set occurrence_id = x.id
from public.event_occurrences x, public.events e
where x.event_id = o.event_id
  and e.id = o.event_id
  and x.starts_at = coalesce(o.occurrence_starts_at, e.starts_at)
  and o.occurrence_id is null;

update public.event_tickets t
set occurrence_id = x.id
from public.event_occurrences x, public.events e
where x.event_id = t.event_id
  and e.id = t.event_id
  and x.starts_at = coalesce(t.occurrence_starts_at, e.starts_at)
  and t.occurrence_id is null;

create or replace function public.set_ticket_occurrence_from_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.occurrence_id is null and new.order_id is not null then
    select occurrence_id into new.occurrence_id
    from public.event_orders
    where id = new.order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_ticket_occurrence_from_order on public.event_tickets;
create trigger set_ticket_occurrence_from_order
before insert or update of order_id on public.event_tickets
for each row execute function public.set_ticket_occurrence_from_order();

create or replace function public.remove_interest_after_admission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_starts timestamptz;
begin
  v_user := new.buyer_id;
  if v_user is null and new.order_id is not null then
    select buyer_id, occurrence_starts_at into v_user, v_starts
    from public.event_orders where id = new.order_id;
  end if;
  if v_starts is null and new.occurrence_id is not null then
    select starts_at into v_starts from public.event_occurrences where id = new.occurrence_id;
  end if;
  if v_user is not null and v_starts is not null then
    delete from public.event_occurrence_interest
    where user_id = v_user and event_id = new.event_id and occurrence_starts_at = v_starts;
    delete from public.member_saves
    where user_id = v_user and kind = 'event' and target_id = new.event_id;
  end if;
  return new;
end;
$$;

drop trigger if exists remove_interest_after_admission on public.event_tickets;
create trigger remove_interest_after_admission
after insert on public.event_tickets
for each row execute function public.remove_interest_after_admission();

create table if not exists public.event_inventory_holds (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.event_occurrences (id) on delete cascade,
  ticket_type_id uuid not null references public.event_ticket_types (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'active'
    check (status in ('active', 'converted', 'expired', 'released')),
  idempotency_key text not null,
  expires_at timestamptz not null,
  order_id uuid references public.event_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists event_inventory_holds_active_idx
  on public.event_inventory_holds (occurrence_id, ticket_type_id, expires_at)
  where status = 'active';

create or replace function public.reserve_event_inventory(
  p_occurrence_id uuid,
  p_ticket_type_id uuid,
  p_quantity integer,
  p_idempotency_key text,
  p_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_issued integer;
  v_held integer;
  v_hold uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_quantity < 1 then raise exception 'quantity must be positive'; end if;
  if not exists (
    select 1 from public.event_orders
    where id = p_order_id and buyer_id = v_user
  ) then
    raise exception 'order not found';
  end if;

  select quantity into v_limit
  from public.event_ticket_types
  where id = p_ticket_type_id
    and event_id = (select event_id from public.event_occurrences where id = p_occurrence_id)
  for update;
  if not found then raise exception 'ticket type not found'; end if;

  select id into v_hold
  from public.event_inventory_holds
  where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then return v_hold; end if;

  select count(*) into v_issued
  from public.event_tickets
  where occurrence_id = p_occurrence_id and ticket_type_id = p_ticket_type_id;
  select coalesce(sum(quantity), 0) into v_held
  from public.event_inventory_holds
  where occurrence_id = p_occurrence_id
    and ticket_type_id = p_ticket_type_id
    and status = 'active'
    and expires_at > now();
  if v_issued + v_held + p_quantity > v_limit then
    raise exception 'Not enough tickets left.';
  end if;

  insert into public.event_inventory_holds (
    occurrence_id, ticket_type_id, user_id, quantity, idempotency_key, expires_at, order_id
  ) values (
    p_occurrence_id, p_ticket_type_id, v_user, p_quantity, p_idempotency_key,
    now() + interval '15 minutes', p_order_id
  )
  returning id into v_hold;
  return v_hold;
end;
$$;

revoke all on function public.reserve_event_inventory(uuid, uuid, integer, text, uuid)
from public, anon;
grant execute on function public.reserve_event_inventory(uuid, uuid, integer, text, uuid)
to authenticated;

create or replace function public.finalise_event_inventory_hold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and old.status is distinct from new.status then
    update public.event_inventory_holds
    set status = 'converted'
    where order_id = new.id and status = 'active';
  elsif new.status in ('failed', 'refunded') and old.status is distinct from new.status then
    update public.event_inventory_holds
    set status = 'released'
    where order_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists finalise_event_inventory_hold on public.event_orders;
create trigger finalise_event_inventory_hold
after update of status on public.event_orders
for each row execute function public.finalise_event_inventory_hold();

create table if not exists public.event_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.event_occurrences (id) on delete cascade,
  ticket_type_id uuid references public.event_ticket_types (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  party_size integer not null default 1 check (party_size between 1 and 20),
  status text not null default 'waiting'
    check (status in ('waiting', 'offered', 'converted', 'expired', 'cancelled')),
  offered_at timestamptz,
  offer_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists event_waitlist_one_open_entry_idx
  on public.event_waitlist_entries (occurrence_id, user_id)
  where status in ('waiting', 'offered');

create table if not exists public.event_outbound_booking_clicks (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  occurrence_id uuid references public.event_occurrences (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  visitor_key uuid,
  source text,
  campaign text,
  clicked_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null check (topic in ('event_reminder', 'community_announcement', 'guide', 'general')),
  channel text not null check (channel in ('email', 'push')),
  scope_type text not null default 'global' check (scope_type in ('global', 'event', 'community')),
  scope_id uuid,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_preferences_scope_idx
  on public.notification_preferences (user_id, topic, channel, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  purpose text not null,
  event_id uuid references public.events (id) on delete cascade,
  occurrence_id uuid references public.event_occurrences (id) on delete cascade,
  community_id uuid references public.communities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  scheduled_for timestamptz not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed', 'skipped', 'cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_jobs_due_idx
  on public.notification_jobs (coalesce(next_attempt_at, scheduled_for), created_at)
  where status in ('queued', 'failed');

create or replace function public.claim_due_notification_jobs(p_limit integer default 50)
returns setof public.notification_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select id
    from public.notification_jobs
    where status in ('queued', 'failed')
      and coalesce(next_attempt_at, scheduled_for) <= now()
      and attempts < 5
    order by coalesce(next_attempt_at, scheduled_for), created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 200)
  )
  update public.notification_jobs j
  set status = 'processing',
      attempts = attempts + 1,
      claimed_at = now(),
      updated_at = now()
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

revoke all on function public.claim_due_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_due_notification_jobs(integer) to service_role;

create or replace function public.invalidate_occurrence_notification_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'scheduled'
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at then
    update public.notification_jobs
    set status = 'cancelled', updated_at = now(), last_error = 'Occurrence changed'
    where occurrence_id = old.id and status in ('queued', 'failed', 'processing');
  end if;
  return new;
end;
$$;

drop trigger if exists invalidate_occurrence_notification_jobs on public.event_occurrences;
create trigger invalidate_occurrence_notification_jobs
after update of status, starts_at, ends_at on public.event_occurrences
for each row execute function public.invalidate_occurrence_notification_jobs();

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.notification_jobs (id) on delete cascade,
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('accepted', 'delivered', 'bounced', 'failed', 'opened', 'clicked')),
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create unique index if not exists notification_delivery_provider_event_idx
  on public.notification_deliveries (provider, provider_message_id, status)
  where provider_message_id is not null;

create table if not exists public.event_day_reports (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.event_occurrences (id) on delete cascade,
  version integer not null default 1,
  generated_at timestamptz not null default now(),
  timezone text not null,
  confirmed_rsvps integer not null default 0,
  valid_tickets integer not null default 0,
  interested integer not null default 0,
  expected_attendance integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  unique (occurrence_id, version)
);

create table if not exists public.za_public_holidays (
  holiday_date date primary key,
  name text not null,
  source text not null default 'operations',
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null
);

insert into public.za_public_holidays (holiday_date, name, source) values
  ('2026-01-01', 'New Year''s Day', 'seed'),
  ('2026-03-21', 'Human Rights Day', 'seed'),
  ('2026-04-03', 'Good Friday', 'seed'),
  ('2026-04-06', 'Family Day', 'seed'),
  ('2026-04-27', 'Freedom Day', 'seed'),
  ('2026-05-01', 'Workers'' Day', 'seed'),
  ('2026-06-16', 'Youth Day', 'seed'),
  ('2026-08-09', 'National Women''s Day', 'seed'),
  ('2026-08-10', 'Public holiday', 'seed'),
  ('2026-09-24', 'Heritage Day', 'seed'),
  ('2026-12-16', 'Day of Reconciliation', 'seed'),
  ('2026-12-25', 'Christmas Day', 'seed'),
  ('2026-12-26', 'Day of Goodwill', 'seed'),
  ('2026-12-28', 'Public holiday', 'seed'),
  ('2027-01-01', 'New Year''s Day', 'seed'),
  ('2027-03-21', 'Human Rights Day', 'seed'),
  ('2027-03-22', 'Public holiday', 'seed'),
  ('2027-03-26', 'Good Friday', 'seed'),
  ('2027-03-29', 'Family Day', 'seed'),
  ('2027-04-27', 'Freedom Day', 'seed'),
  ('2027-05-01', 'Workers'' Day', 'seed'),
  ('2027-05-03', 'Public holiday', 'seed'),
  ('2027-06-16', 'Youth Day', 'seed'),
  ('2027-08-09', 'National Women''s Day', 'seed'),
  ('2027-09-24', 'Heritage Day', 'seed'),
  ('2027-12-16', 'Day of Reconciliation', 'seed'),
  ('2027-12-25', 'Christmas Day', 'seed'),
  ('2027-12-27', 'Public holiday', 'seed')
on conflict (holiday_date) do nothing;

create or replace function public.add_za_working_days(p_from date, p_days integer)
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  v_day date := p_from;
  v_added integer := 0;
begin
  while v_added < greatest(p_days, 0) loop
    v_day := v_day + 1;
    if extract(isodow from v_day) < 6
       and not exists (select 1 from public.za_public_holidays h where h.holiday_date = v_day) then
      v_added := v_added + 1;
    end if;
  end loop;
  return v_day;
end;
$$;

create or replace function public.set_event_booking_method(
  p_event_id uuid,
  p_method text,
  p_provider_name text default null,
  p_external_url text default null,
  p_waitlist_enabled boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_has_admissions boolean;
begin
  if auth.uid() is null or not public.can_manage_event(p_event_id) then
    raise exception 'not allowed';
  end if;
  if p_method not in ('free_rsvp', 'venturo_ticketing', 'external') then
    raise exception 'invalid booking method';
  end if;
  if p_method = 'external' and (
    nullif(btrim(p_provider_name), '') is null
    or p_external_url !~* '^https://'
  ) then
    raise exception 'External booking needs a provider and HTTPS URL.';
  end if;

  select booking_method into v_current from public.events where id = p_event_id for update;
  if not found then raise exception 'event not found'; end if;
  select exists (
    select 1 from public.event_tickets where event_id = p_event_id
  ) into v_has_admissions;
  if v_current <> p_method and v_has_admissions then
    raise exception 'Booking method is locked after the first admission. Use the audited admin migration flow.';
  end if;

  update public.events
  set booking_method = p_method,
      external_provider_name = case when p_method = 'external' then nullif(btrim(p_provider_name), '') else null end,
      external_booking_url = case when p_method = 'external' then p_external_url else null end,
      external_booking_verified_at = case when p_method = 'external' and public.is_staff() then now() else null end,
      waitlist_enabled = case when p_method <> 'external' then p_waitlist_enabled else false end,
      updated_at = now()
  where id = p_event_id;

  insert into public.event_audit_events (event_id, actor_id, action, before, after)
  values (
    p_event_id,
    auth.uid(),
    'booking_method_changed',
    jsonb_build_object('booking_method', v_current),
    jsonb_build_object('booking_method', p_method, 'provider', p_provider_name)
  );
end;
$$;

create or replace function public.sync_event_base_occurrence(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_id uuid;
begin
  if auth.uid() is null or not public.can_manage_event(p_event_id) then
    raise exception 'not allowed';
  end if;
  select * into v_event from public.events where id = p_event_id;
  if not found or v_event.starts_at is null then raise exception 'event date missing'; end if;
  insert into public.event_occurrences (event_id, starts_at, ends_at, timezone)
  values (v_event.id, v_event.starts_at, v_event.ends_at, coalesce(v_event.timezone, 'Africa/Johannesburg'))
  on conflict (event_id, starts_at) do update
    set ends_at = excluded.ends_at, timezone = excluded.timezone, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.sync_event_occurrences(p_event_id uuid, p_occurrences jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_count integer := 0;
  v_timezone text;
begin
  if auth.uid() is null or not public.can_manage_event(p_event_id) then
    raise exception 'not allowed';
  end if;
  select coalesce(nullif(timezone, ''), 'Africa/Johannesburg')
  into v_timezone from public.events where id = p_event_id;
  if not found then raise exception 'event not found'; end if;
  if jsonb_typeof(p_occurrences) <> 'array' then raise exception 'occurrences must be an array'; end if;

  for v_item in select * from jsonb_array_elements(p_occurrences)
  loop
    insert into public.event_occurrences (event_id, starts_at, ends_at, timezone)
    values (
      p_event_id,
      (v_item->>'startsAt')::timestamptz,
      nullif(v_item->>'endsAt', '')::timestamptz,
      v_timezone
    )
    on conflict (event_id, starts_at) do update
      set ends_at = excluded.ends_at, timezone = excluded.timezone, updated_at = now();
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create table if not exists public.event_cases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  order_id uuid references public.event_orders (id) on delete set null,
  kind text not null check (kind in ('complaint', 'investigation', 'chargeback', 'refund')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'dismissed')),
  summary text not null,
  opened_by uuid references auth.users (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_adjustments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  order_id uuid references public.event_orders (id) on delete set null,
  case_id uuid references public.event_cases (id) on delete set null,
  kind text not null check (kind in ('refund', 'fee', 'chargeback', 'credit', 'debit', 'other')),
  amount_cents integer not null,
  reason text not null,
  provider_reference text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.event_payouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  status text not null default 'provisional'
    check (status in ('provisional', 'eligible', 'held', 'approved', 'paid', 'cancelled')),
  due_date date,
  gross_cents integer not null default 0,
  refund_cents integer not null default 0,
  fee_cents integer not null default 0,
  adjustment_cents integer not null default 0,
  payable_cents integer not null default 0,
  payout_account_reference text,
  payment_reference text,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references auth.users (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id)
);

create table if not exists public.payout_holds (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.event_payouts (id) on delete cascade,
  case_id uuid references public.event_cases (id) on delete set null,
  reason text not null,
  amount_cents integer,
  status text not null default 'active' check (status in ('active', 'released', 'applied')),
  review_due_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  released_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.event_financial_statements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  version integer not null,
  status text not null default 'provisional' check (status in ('provisional', 'final', 'superseded')),
  audience text not null check (audience in ('host', 'venturo')),
  generated_at timestamptz not null default now(),
  totals jsonb not null default '{}'::jsonb,
  unique (event_id, version, audience)
);

create table if not exists public.event_financial_statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.event_financial_statements (id) on delete cascade,
  kind text not null,
  label text not null,
  amount_cents integer not null,
  reference_type text,
  reference_id uuid,
  sort_order integer not null default 0
);

alter table public.interests
  add column if not exists description text,
  add column if not exists icon_path text,
  add column if not exists icon_version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.event_interests (
  event_id uuid not null references public.events (id) on delete cascade,
  interest_id uuid not null references public.interests (id) on delete restrict,
  primary key (event_id, interest_id)
);

create table if not exists public.community_interests (
  community_id uuid not null references public.communities (id) on delete cascade,
  interest_id uuid not null references public.interests (id) on delete restrict,
  primary key (community_id, interest_id)
);

insert into public.event_interests (event_id, interest_id)
select e.id, i.id
from public.events e
join public.interests i on lower(i.title) = lower(e.category)
where e.category is not null
on conflict do nothing;

insert into public.community_interests (community_id, interest_id)
select c.id, i.id
from public.communities c
join public.interests i
  on exists (
    select 1
    from regexp_split_to_table(coalesce(c.interest_keywords, c.interest, ''), '\s*,\s*') keyword
    where lower(btrim(keyword)) = lower(i.title)
  )
on conflict do nothing;

alter table public.event_interests enable row level security;
alter table public.community_interests enable row level security;

create policy "Public reads event interests"
  on public.event_interests for select to anon, authenticated using (true);
create policy "Public reads community interests"
  on public.community_interests for select to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'interest-icons',
  'interest-icons',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads interest icons" on storage.objects;
create policy "Public reads interest icons"
  on storage.objects for select to public
  using (bucket_id = 'interest-icons');

create table if not exists public.community_managers (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'manager' check (role in ('owner', 'manager')),
  status text not null default 'active' check (status in ('invited', 'active', 'revoked')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.push_campaigns
  drop constraint if exists push_campaigns_opens_kind;
alter table public.push_campaigns
  add constraint push_campaigns_opens_kind
  check (opens_kind is null or opens_kind in ('guide', 'event', 'community'));

insert into public.community_managers (community_id, user_id, role, status)
select id, claimed_by, 'owner', 'active'
from public.communities
where claimed_by is not null
on conflict (community_id, user_id) do nothing;

alter table public.community_follows
  add column if not exists host_visible boolean not null default false,
  add column if not exists email_enabled boolean not null default false,
  add column if not exists push_enabled boolean not null default true,
  add column if not exists muted_at timestamptz;

create table if not exists public.community_announcement_settings (
  id integer primary key default 1 check (id = 1),
  weekly_general_limit integer not null default 2 check (weekly_general_limit between 0 and 20),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.community_announcement_settings (id) values (1)
on conflict (id) do nothing;

create table if not exists public.community_follow_events (
  id bigint generated always as identity primary key,
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('follow', 'unfollow', 'visibility_on', 'visibility_off', 'mute', 'unmute')),
  occurred_at timestamptz not null default now()
);

insert into public.community_follow_events (community_id, user_id, action, occurred_at)
select community_id, user_id, 'follow', created_at
from public.community_follows
where not exists (
  select 1
  from public.community_follow_events e
  where e.community_id = community_follows.community_id
    and e.user_id = community_follows.user_id
    and e.action = 'follow'
);

create table if not exists public.community_claim_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  evidence text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (community_id, requested_by)
);

do $$
begin
  if to_regprocedure('public.claim_community(uuid)') is not null then
    revoke execute on function public.claim_community(uuid) from authenticated;
  end if;
end
$$;

create or replace function public.can_manage_community(p_community_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_staff() or exists (
    select 1
    from public.community_managers m
    where m.community_id = p_community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create table if not exists public.community_announcements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  title text not null,
  body text not null,
  destination_path text not null,
  category text not null default 'general' check (category in ('general', 'essential')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  eligible_count integer not null default 0,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notification_jobs
  add column if not exists announcement_id uuid
    references public.community_announcements (id) on delete cascade;
create index if not exists notification_jobs_announcement_idx
  on public.notification_jobs (announcement_id, status);

create schema if not exists private;
create or replace function private.log_community_follow_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.community_follow_events (community_id, user_id, action)
    values (new.community_id, new.user_id, 'follow');
    if new.host_visible then
      insert into public.community_follow_events (community_id, user_id, action)
      values (new.community_id, new.user_id, 'visibility_on');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.community_follow_events (community_id, user_id, action)
    values (old.community_id, old.user_id, 'unfollow');
    return old;
  end if;
  if new.host_visible is distinct from old.host_visible then
    insert into public.community_follow_events (community_id, user_id, action)
    values (new.community_id, new.user_id, case when new.host_visible then 'visibility_on' else 'visibility_off' end);
  end if;
  if new.muted_at is distinct from old.muted_at then
    insert into public.community_follow_events (community_id, user_id, action)
    values (new.community_id, new.user_id, case when new.muted_at is null then 'unmute' else 'mute' end);
  end if;
  return new;
end;
$$;

drop trigger if exists community_follow_audit on public.community_follows;
create trigger community_follow_audit
after insert or update or delete on public.community_follows
for each row execute function private.log_community_follow_change();

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  announcement_id uuid references public.community_announcements (id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_sessions (
  id uuid primary key,
  visitor_key uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  entry_path text not null,
  referrer_host text,
  source text,
  medium text,
  campaign text,
  country_code text,
  region text,
  city text,
  traffic_class text not null default 'unknown'
    check (traffic_class in ('likely_human', 'verified_bot', 'suspected_bot', 'unknown')),
  classification_reasons text[] not null default '{}',
  ip_signal text,
  is_staff boolean not null default false
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.analytics_sessions (id) on delete cascade,
  visitor_key uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  path text not null,
  entity_type text,
  entity_id uuid,
  active_seconds integer not null default 0 check (active_seconds between 0 and 3600),
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.app_engagement_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (name in ('screen_view', 'click', 'rsvp', 'purchase', 'calendar_add', 'notification_open')),
  screen text not null,
  item_kind text check (item_kind in ('listing', 'event', 'community', 'guide')),
  item_id uuid,
  idempotency_key text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create unique index if not exists app_engagement_idempotency_idx
  on public.app_engagement_events (user_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists app_engagement_range_idx
  on public.app_engagement_events (occurred_at, name, item_kind, item_id);

create index if not exists analytics_events_range_idx
  on public.analytics_events (occurred_at, name, path);
create index if not exists analytics_events_entity_idx
  on public.analytics_events (entity_type, entity_id, occurred_at);
create index if not exists analytics_sessions_range_idx
  on public.analytics_sessions (started_at, traffic_class, is_staff);
create index if not exists analytics_sessions_ip_signal_idx
  on public.analytics_sessions (ip_signal, started_at) where ip_signal is not null;

create or replace function public.website_analytics_summary(
  p_from date,
  p_to date,
  p_include_excluded boolean default false
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with selected_sessions as (
    select s.*
    from public.analytics_sessions s
    where (s.started_at at time zone 'Africa/Johannesburg')::date <= p_to
      and s.last_seen_at >= (p_from::timestamp at time zone 'Africa/Johannesburg')
      and (
        p_include_excluded
        or (not s.is_staff and s.traffic_class in ('likely_human', 'unknown'))
      )
  ),
  selected_events as (
    select e.*, (e.occurred_at at time zone 'Africa/Johannesburg')::date as local_day
    from public.analytics_events e
    join selected_sessions s on s.id = e.session_id
    where (e.occurred_at at time zone 'Africa/Johannesburg')::date between p_from and p_to
  ),
  daily as (
    select local_day as day,
      count(*) filter (where name = 'page_view') as pageviews,
      count(distinct visitor_key) filter (where name = 'page_view') as visitors
    from selected_events group by local_day
  ),
  pages as (
    select path,
      count(*) filter (where name = 'page_view') as pageviews,
      count(distinct visitor_key) filter (where name = 'page_view') as visitors,
      coalesce(sum(active_seconds) filter (where name = 'active_time'), 0) as active_seconds
    from selected_events group by path
  ),
  locations as (
    select coalesce(country_code, 'Unknown') as country,
      coalesce(region, 'Unknown') as region,
      coalesce(city, 'Unknown') as city,
      count(distinct visitor_key) as visitors
    from selected_sessions group by 1, 2, 3
  ),
  sources as (
    select coalesce(source, 'direct') as source,
      coalesce(medium, 'none') as medium,
      coalesce(campaign, '—') as campaign,
      count(distinct visitor_key) as visitors
    from selected_sessions group by 1, 2, 3
  ),
  classes as (
    select traffic_class, is_staff, count(*) as sessions
    from public.analytics_sessions
    where (started_at at time zone 'Africa/Johannesburg')::date between p_from and p_to
    group by traffic_class, is_staff
  ),
  reasons as (
    select reason, count(*) as sessions
    from public.analytics_sessions s
    cross join lateral unnest(s.classification_reasons) reason
    where (s.started_at at time zone 'Africa/Johannesburg')::date between p_from and p_to
      and (s.is_staff or s.traffic_class in ('verified_bot', 'suspected_bot'))
    group by reason
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'pageviews', (select count(*) from selected_events where name = 'page_view'),
      'visitors', (select count(distinct visitor_key) from selected_events where name = 'page_view'),
      'sessions', (select count(distinct session_id) from selected_events),
      'active_seconds', (select coalesce(sum(active_seconds), 0) from selected_events),
      'clicks', (select count(*) from selected_events where name = 'click'),
      'rsvps', (select count(*) from selected_events where name = 'rsvp'),
      'purchases', (select count(*) from selected_events where name = 'purchase')
    ),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily) order by day) from daily), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(to_jsonb(pages) order by pageviews desc) from pages), '[]'::jsonb),
    'locations', coalesce((select jsonb_agg(to_jsonb(locations) order by visitors desc) from locations), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(to_jsonb(sources) order by visitors desc) from sources), '[]'::jsonb),
    'classes', coalesce((select jsonb_agg(to_jsonb(classes) order by sessions desc) from classes), '[]'::jsonb),
    'reasons', coalesce((select jsonb_agg(to_jsonb(reasons) order by sessions desc) from reasons), '[]'::jsonb)
  );
$$;

create or replace function public.prune_analytics_diagnostics()
returns integer
language plpgsql
set search_path = public
as $$
declare
  changed integer;
begin
  update public.analytics_sessions
  set ip_signal = null
  where ip_signal is not null and started_at < now() - interval '30 days';
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.website_analytics_summary(date, date, boolean) from public;
revoke all on function public.prune_analytics_diagnostics() from public;
grant execute on function public.website_analytics_summary(date, date, boolean) to authenticated, service_role;
grant execute on function public.prune_analytics_diagnostics() to service_role;

alter table public.curated_guide_events
  add column if not exists sort_order integer not null default 0,
  add column if not exists editorial_note text,
  add column if not exists presentation text not null default 'card'
    check (presentation in ('card', 'feature', 'compact'));

alter table public.curated_guides
  add column if not exists guide_kind text not null default 'activities'
    check (guide_kind in ('activities', 'events', 'mixed'));

-- Move the legacy Event Guide records into the standard Guide workflow/editor.
insert into public.curated_guides (
  id, title, slug, intro, body, status, shape, publish_at, expire_at,
  author_id, place_ids, created_by, updated_by, created_at, updated_at, guide_kind
)
select
  eg.id,
  eg.title,
  case
    when exists (select 1 from public.curated_guides g where g.slug = eg.slug)
      then eg.slug || '-events-' || left(eg.id::text, 8)
    else eg.slug
  end,
  eg.intro,
  eg.body,
  eg.status,
  eg.shape,
  eg.publish_at,
  eg.expire_at,
  eg.author_id,
  eg.place_ids,
  eg.created_by,
  eg.updated_by,
  eg.created_at,
  eg.updated_at,
  'events'
from public.curated_event_guides eg
on conflict (id) do nothing;

insert into public.curated_guide_events (guide_id, event_id, sort_order, editorial_note, presentation)
select guide_id, event_id, sort_order, editorial_note, 'card'
from public.curated_event_guide_items
on conflict (guide_id, event_id) do update
set sort_order = excluded.sort_order,
    editorial_note = excluded.editorial_note;

update public.curated_event_guides
set status = 'archived'
where id in (select id from public.curated_guides where guide_kind = 'events');

alter table public.event_occurrences enable row level security;
alter table public.event_inventory_holds enable row level security;
alter table public.event_waitlist_entries enable row level security;
alter table public.event_outbound_booking_clicks enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.event_day_reports enable row level security;
alter table public.event_cases enable row level security;
alter table public.event_adjustments enable row level security;
alter table public.event_payouts enable row level security;
alter table public.payout_holds enable row level security;
alter table public.event_financial_statements enable row level security;
alter table public.event_financial_statement_lines enable row level security;
alter table public.community_managers enable row level security;
alter table public.community_announcement_settings enable row level security;
alter table public.community_follow_events enable row level security;
alter table public.community_claim_requests enable row level security;
alter table public.community_announcements enable row level security;
alter table public.community_reports enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.app_engagement_events enable row level security;

create policy "Public reads published event occurrences"
  on public.event_occurrences for select to anon, authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id
      and ((e.status = 'approved' and e.visibility = 'public') or e.organiser_id = (select auth.uid()) or public.is_staff())
  ));

create policy "Members manage own active holds"
  on public.event_inventory_holds for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy "Members manage own waitlist"
  on public.event_waitlist_entries for all to authenticated
  using (user_id = (select auth.uid()) or public.is_staff())
  with check (user_id = (select auth.uid()) or public.is_staff());

create policy "Members manage notification preferences"
  on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Staff reads notification jobs"
  on public.notification_jobs for select to authenticated
  using (public.is_staff());

create policy "Staff reads notification deliveries"
  on public.notification_deliveries for select to authenticated
  using (public.is_staff());

create policy "Event managers read day reports"
  on public.event_day_reports for select to authenticated
  using (exists (
    select 1
    from public.event_occurrences o
    join public.events e on e.id = o.event_id
    where o.id = occurrence_id
      and (e.organiser_id = (select auth.uid()) or public.is_staff())
  ));

create policy "Staff manages financial records"
  on public.event_cases for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff manages adjustments"
  on public.event_adjustments for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff manages payouts"
  on public.event_payouts for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff manages payout holds"
  on public.payout_holds for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff manages statements"
  on public.event_financial_statements for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff manages statement lines"
  on public.event_financial_statement_lines for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "Managers read own community roles"
  on public.community_managers for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy "Managers read managed communities"
  on public.communities for select to authenticated
  using (public.can_manage_community(id));

create policy "Authenticated reads community announcement settings"
  on public.community_announcement_settings for select to authenticated using (true);
create policy "Staff manages community announcement settings"
  on public.community_announcement_settings for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists community_follows_read on public.community_follows;
create policy community_follows_read
  on public.community_follows for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_staff()
    or (host_visible and public.can_manage_community(community_id))
  );

create policy "Members request community claims"
  on public.community_claim_requests for insert to authenticated
  with check (requested_by = (select auth.uid()));
create policy "Members read own claim requests"
  on public.community_claim_requests for select to authenticated
  using (requested_by = (select auth.uid()) or public.is_staff());
create policy "Members update own pending claim requests"
  on public.community_claim_requests for update to authenticated
  using (requested_by = (select auth.uid()) and status = 'pending')
  with check (requested_by = (select auth.uid()) and status in ('pending', 'withdrawn'));

create policy "Managers manage community announcements"
  on public.community_announcements for all to authenticated
  using (public.can_manage_community(community_id))
  with check (public.can_manage_community(community_id) and author_id = (select auth.uid()));

create policy "Members create community reports"
  on public.community_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "Managers read community reports"
  on public.community_reports for select to authenticated
  using (public.can_manage_community(community_id));

create policy "Staff reads analytics sessions"
  on public.analytics_sessions for select to authenticated using (public.is_staff());
create policy "Staff reads analytics events"
  on public.analytics_events for select to authenticated using (public.is_staff());
create policy "Staff reads app engagement events"
  on public.app_engagement_events for select to authenticated using (public.is_staff());

revoke all on public.event_outbound_booking_clicks, public.notification_jobs,
  public.notification_deliveries, public.analytics_sessions, public.analytics_events
from anon, authenticated;
revoke all on public.app_engagement_events from anon, authenticated;

grant select on public.community_managers to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select on public.community_announcement_settings to authenticated;
grant insert, update, delete on public.community_announcement_settings to authenticated;
grant select, insert, update on public.community_claim_requests to authenticated;
grant select, insert, update, delete on public.community_announcements to authenticated;
grant select, insert on public.community_reports to authenticated;
