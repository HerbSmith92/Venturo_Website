-- Author follows, and a public attendance preview that does not publish names.

create table if not exists public.author_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  author_id uuid not null references public.guide_authors (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, author_id)
);

alter table public.author_follows enable row level security;

drop policy if exists author_follows_own on public.author_follows;
create policy author_follows_own
  on public.author_follows
  for all
  to authenticated
  using (user_id = (select auth.uid()) or public.is_staff())
  with check (user_id = (select auth.uid()));

grant select, insert, delete on public.author_follows to authenticated;

create or replace function public.event_attendance_preview(p_event_id uuid)
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

  select count(distinct buyer_id)::integer into v_going
  from public.event_tickets
  where event_id = p_event_id
    and buyer_id is not null;

  select count(*)::integer into v_interested
  from public.member_saves
  where kind = 'event'
    and target_id = p_event_id;

  select count(*)::integer into v_people
  from (
    select buyer_id as user_id
    from public.event_tickets
    where event_id = p_event_id and buyer_id is not null
    union
    select user_id
    from public.member_saves
    where kind = 'event' and target_id = p_event_id
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
        select distinct buyer_id as user_id, 0 as rank
        from public.event_tickets
        where event_id = p_event_id and buyer_id is not null
        union all
        select s.user_id, 1 as rank
        from public.member_saves s
        where s.kind = 'event'
          and s.target_id = p_event_id
          and not exists (
            select 1 from public.event_tickets t
            where t.event_id = p_event_id and t.buyer_id = s.user_id
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

revoke all on function public.event_attendance_preview(uuid) from public, anon;
grant execute on function public.event_attendance_preview(uuid) to anon, authenticated;
