-- Hosts can pass platform commission & booking fees on to the buyer, per ticket type.
alter table public.event_ticket_types
  add column if not exists pass_fees_to_buyer boolean not null default false;
