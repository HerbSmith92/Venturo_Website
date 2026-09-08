-- Existing event_invites (host tools) predates Menu. Add kind so invite links can be created.

alter table public.event_invites
  add column if not exists kind text,
  add column if not exists ticket_id uuid references public.event_tickets (id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'event_invites'
      and column_name = 'complimentary'
  ) then
    update public.event_invites
      set kind = case when coalesce(complimentary, false) then 'rsvp' else 'invite' end
      where kind is null;
  else
    update public.event_invites set kind = 'invite' where kind is null;
  end if;
end $$;

alter table public.event_invites alter column kind set default 'invite';
update public.event_invites set kind = 'invite' where kind is null;
alter table public.event_invites alter column kind set not null;

alter table public.event_invites drop constraint if exists event_invites_kind_check;
alter table public.event_invites
  add constraint event_invites_kind_check check (kind in ('invite', 'rsvp'));

alter table public.event_invites drop constraint if exists event_invites_status_check;
alter table public.event_invites
  add constraint event_invites_status_check
  check (status in ('pending', 'opened', 'booked', 'claimed', 'accepted', 'revoked'));

notify pgrst, 'reload schema';
