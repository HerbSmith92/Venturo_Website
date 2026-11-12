-- Going & interested on a repeating event are counted for the chosen date.
-- The app should call event_attendance_preview(event_id, occurrence_starts_at).
-- Omit the second argument only when there is no date chip (single session).

create table if not exists public.event_occurrence_interest (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  occurrence_starts_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id, occurrence_starts_at)
);

create index if not exists event_occurrence_interest_event_occ_idx
  on public.event_occurrence_interest (event_id, occurrence_starts_at);

alter table public.event_occurrence_interest enable row level security;

drop policy if exists event_occurrence_interest_own on public.event_occurrence_interest;
create policy event_occurrence_interest_own
  on public.event_occurrence_interest
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.event_occurrence_interest from public, anon;
grant select, insert, delete on table public.event_occurrence_interest to authenticated;

drop function if exists public.event_attendance_preview(uuid);
drop function if exists public.event_attendance_preview(uuid, timestamptz);

create or replace function public.event_attendance_preview(
  p_event_id uuid,
  p_occurrence_starts_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_going integer;
  v_interested integer;
  v_initials text[] := '{}';
  v_shown integer;
  v_people integer;
begin
  if p_event_id is null then
    return jsonb_build_object('going', 0, 'interested', 0, 'initials', '[]'::jsonb, 'extra', 0);
  end if;

  select count(distinct t.buyer_id)::integer into v_going
  from public.event_tickets t
  where t.event_id = p_event_id
    and t.buyer_id is not null
    and (
      p_occurrence_starts_at is null
      or t.occurrence_starts_at = p_occurrence_starts_at
      or (
        t.occurrence_starts_at is null
        and exists (
          select 1
          from public.events e
          where e.id = p_event_id
            and e.starts_at = p_occurrence_starts_at
        )
      )
    );

  if p_occurrence_starts_at is null then
    select count(*)::integer into v_interested
    from public.member_saves
    where kind = 'event'
      and target_id = p_event_id;
  else
    select count(*)::integer into v_interested
    from public.event_occurrence_interest
    where event_id = p_event_id
      and occurrence_starts_at = p_occurrence_starts_at;
  end if;

  select count(*)::integer into v_people
  from (
    select t.buyer_id as user_id
    from public.event_tickets t
    where t.event_id = p_event_id
      and t.buyer_id is not null
      and (
        p_occurrence_starts_at is null
        or t.occurrence_starts_at = p_occurrence_starts_at
        or (
          t.occurrence_starts_at is null
          and exists (
            select 1
            from public.events e
            where e.id = p_event_id
              and e.starts_at = p_occurrence_starts_at
          )
        )
      )
    union
    select s.user_id
    from public.member_saves s
    where p_occurrence_starts_at is null
      and s.kind = 'event'
      and s.target_id = p_event_id
    union
    select i.user_id
    from public.event_occurrence_interest i
    where p_occurrence_starts_at is not null
      and i.event_id = p_event_id
      and i.occurrence_starts_at = p_occurrence_starts_at
  ) everyone;

  select coalesce(array_agg(letter order by rank, user_id), '{}')
    into v_initials
  from (
    select
      o.user_id,
      o.rank,
      case
        when btrim(coalesce(p.display_name, '')) = '' then 'V'
        else upper(left(btrim(p.display_name), 1))
      end as letter
    from (
      select user_id, min(rank) as rank
      from (
        select distinct t.buyer_id as user_id, 0 as rank
        from public.event_tickets t
        where t.event_id = p_event_id
          and t.buyer_id is not null
          and (
            p_occurrence_starts_at is null
            or t.occurrence_starts_at = p_occurrence_starts_at
            or (
              t.occurrence_starts_at is null
              and exists (
                select 1
                from public.events e
                where e.id = p_event_id
                  and e.starts_at = p_occurrence_starts_at
              )
            )
          )
        union all
        select s.user_id, 1 as rank
        from public.member_saves s
        where p_occurrence_starts_at is null
          and s.kind = 'event'
          and s.target_id = p_event_id
          and not exists (
            select 1 from public.event_tickets t
            where t.event_id = p_event_id and t.buyer_id = s.user_id
          )
        union all
        select i.user_id, 1 as rank
        from public.event_occurrence_interest i
        where p_occurrence_starts_at is not null
          and i.event_id = p_event_id
          and i.occurrence_starts_at = p_occurrence_starts_at
          and not exists (
            select 1 from public.event_tickets t
            where t.event_id = p_event_id
              and t.buyer_id = i.user_id
              and t.occurrence_starts_at = p_occurrence_starts_at
          )
      ) tagged
      group by user_id
    ) o
    left join public.profiles p on p.id = o.user_id
    order by o.rank, o.user_id
    limit 5
  ) faces;

  v_shown := coalesce(array_length(v_initials, 1), 0);

  return jsonb_build_object(
    'going', coalesce(v_going, 0),
    'interested', coalesce(v_interested, 0),
    'initials', to_jsonb(coalesce(v_initials, '{}')),
    'extra', greatest(coalesce(v_people, 0) - v_shown, 0)
  );
end;
$$;

revoke all on function public.event_attendance_preview(uuid, timestamptz) from public;
grant execute on function public.event_attendance_preview(uuid, timestamptz) to anon, authenticated;

create or replace function public.toggle_event_occurrence_interest(
  p_event_id uuid,
  p_occurrence_starts_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_exists boolean;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if p_event_id is null or p_occurrence_starts_at is null then
    raise exception 'Event and date are required';
  end if;

  select exists (
    select 1
    from public.event_occurrence_interest
    where user_id = v_actor
      and event_id = p_event_id
      and occurrence_starts_at = p_occurrence_starts_at
  ) into v_exists;

  if v_exists then
    delete from public.event_occurrence_interest
    where user_id = v_actor
      and event_id = p_event_id
      and occurrence_starts_at = p_occurrence_starts_at;
    return false;
  end if;

  insert into public.event_occurrence_interest (user_id, event_id, occurrence_starts_at)
  values (v_actor, p_event_id, p_occurrence_starts_at);
  return true;
end;
$$;

revoke all on function public.toggle_event_occurrence_interest(uuid, timestamptz) from public, anon;
grant execute on function public.toggle_event_occurrence_interest(uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
