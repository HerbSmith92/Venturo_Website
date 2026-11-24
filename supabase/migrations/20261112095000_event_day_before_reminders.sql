-- One day-before reminder per event. The morning job claims the row before it sends.

create table if not exists public.event_reminder_sends (
  event_id uuid primary key references public.events (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.event_reminder_sends enable row level security;

drop policy if exists event_reminder_sends_staff_read on public.event_reminder_sends;
create policy event_reminder_sends_staff_read
  on public.event_reminder_sends
  for select
  to authenticated
  using (public.is_staff());

revoke all on public.event_reminder_sends from public, anon, authenticated;
grant select on public.event_reminder_sends to authenticated;
grant all on public.event_reminder_sends to service_role;
