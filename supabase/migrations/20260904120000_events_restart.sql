-- Restart Events: Howler-style drafts (name first) plus information policies.
-- Clears the previous demo event so the public calendar starts empty.

delete from public.event_tickets;
delete from public.event_order_items;
delete from public.event_orders;
delete from public.event_ticket_types;
delete from public.event_audit_events;
delete from public.events;

alter table public.events drop constraint if exists events_check;

alter table public.events
  alter column starts_at drop not null,
  alter column ends_at drop not null;

alter table public.events
  add constraint events_time_range_check
  check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and ends_at >= starts_at)
  );

alter table public.events
  add column if not exists parking text,
  add column if not exists prohibited_items text;
