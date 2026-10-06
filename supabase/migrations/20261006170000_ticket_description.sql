alter table public.event_ticket_types
  add column if not exists description text not null default '';
