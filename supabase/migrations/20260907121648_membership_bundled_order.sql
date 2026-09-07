-- Link a PayFast membership checkout to a ticket order so join & buy
-- can charge membership + tickets on the first payment, then membership only.

alter table public.memberships
  add column if not exists bundled_order_id uuid
    references public.event_orders (id) on delete set null;

create index if not exists memberships_bundled_order_idx
  on public.memberships (bundled_order_id)
  where bundled_order_id is not null;
