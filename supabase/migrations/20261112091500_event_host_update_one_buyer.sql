-- Host “Send update” counts people, not tickets. Rate-limit lookups stay cheap.

create index if not exists event_attendee_updates_event_created_idx
  on public.event_attendee_updates (event_id, created_at desc);

create or replace function public.event_update_audience(p_event_id uuid, p_audience text)
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_audience not in ('all', 'checked_in', 'waiting') then
    raise exception 'unknown audience';
  end if;
  if not public.event_hub_can(p_event_id, 'send_messages') then
    raise exception 'not allowed';
  end if;

  return query
  with guests as (
    select
      t.buyer_id,
      bool_or(t.scanned_at is not null) as arrived
    from public.event_tickets t
    where t.event_id = p_event_id
      and t.buyer_id is not null
      and private.ticket_admission_state(t.order_id) = 'expected'
    group by t.buyer_id
  )
  select guests.buyer_id
  from guests
  where p_audience = 'all'
     or (p_audience = 'checked_in' and guests.arrived)
     or (p_audience = 'waiting' and not guests.arrived);
end;
$$;

revoke all on function public.event_update_audience(uuid, text) from public, anon;
grant execute on function public.event_update_audience(uuid, text) to authenticated, service_role;
