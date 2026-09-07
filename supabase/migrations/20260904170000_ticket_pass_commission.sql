alter table public.event_ticket_types
  add column if not exists pass_commission_to_buyer boolean not null default false;
