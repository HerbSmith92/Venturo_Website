-- One ticket email per paid order. Cleared again if the send fails.
alter table public.event_orders
  add column if not exists ticket_email_sent_at timestamptz;
