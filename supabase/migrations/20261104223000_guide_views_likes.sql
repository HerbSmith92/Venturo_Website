alter table public.curated_guides
  add column if not exists view_count integer not null default 0,
  add column if not exists like_count integer not null default 0;

alter table public.curated_event_guides
  add column if not exists view_count integer not null default 0,
  add column if not exists like_count integer not null default 0;

alter table public.curated_guides
  drop constraint if exists curated_guides_view_count_check;
alter table public.curated_guides
  add constraint curated_guides_view_count_check check (view_count >= 0);
alter table public.curated_guides
  drop constraint if exists curated_guides_like_count_check;
alter table public.curated_guides
  add constraint curated_guides_like_count_check check (like_count >= 0);

alter table public.curated_event_guides
  drop constraint if exists curated_event_guides_view_count_check;
alter table public.curated_event_guides
  add constraint curated_event_guides_view_count_check check (view_count >= 0);
alter table public.curated_event_guides
  drop constraint if exists curated_event_guides_like_count_check;
alter table public.curated_event_guides
  add constraint curated_event_guides_like_count_check check (like_count >= 0);

create index if not exists curated_guides_popular_idx
  on public.curated_guides (like_count desc, view_count desc);
create index if not exists curated_guides_viewed_idx
  on public.curated_guides (view_count desc);
create index if not exists curated_event_guides_popular_idx
  on public.curated_event_guides (like_count desc, view_count desc);
create index if not exists curated_event_guides_viewed_idx
  on public.curated_event_guides (view_count desc);

create table if not exists public.guide_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  guide_kind text not null check (guide_kind in ('activities', 'events')),
  guide_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, guide_kind, guide_id)
);

create index if not exists guide_likes_guide_idx
  on public.guide_likes (guide_kind, guide_id);

create table if not exists public.guide_view_days (
  guide_kind text not null check (guide_kind in ('activities', 'events')),
  guide_id uuid not null,
  visitor_key text not null,
  viewed_on date not null,
  primary key (guide_kind, guide_id, visitor_key, viewed_on)
);

alter table public.guide_likes enable row level security;
alter table public.guide_view_days enable row level security;

revoke all on table public.guide_likes from public, anon;
revoke all on table public.guide_view_days from public, anon, authenticated;
grant select, insert, delete on table public.guide_likes to authenticated;

drop policy if exists guide_likes_own on public.guide_likes;
create policy guide_likes_own
  on public.guide_likes
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.toggle_guide_like(p_kind text, p_guide_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_liked boolean;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Sign in to like a guide';
  end if;
  if p_kind not in ('activities', 'events') or p_guide_id is null then
    raise exception 'Unknown guide';
  end if;

  if p_kind = 'activities' then
    if not exists (
      select 1 from public.curated_guides
      where id = p_guide_id and public.curated_guide_is_live(status, publish_at, expire_at)
    ) then
      raise exception 'Guide not found';
    end if;
  else
    if not exists (
      select 1 from public.curated_event_guides
      where id = p_guide_id and public.curated_guide_is_live(status, publish_at, expire_at)
    ) then
      raise exception 'Guide not found';
    end if;
  end if;

  delete from public.guide_likes
  where user_id = v_user
    and guide_kind = p_kind
    and guide_id = p_guide_id;
  if found then
    v_liked := false;
  else
    insert into public.guide_likes (user_id, guide_kind, guide_id)
    values (v_user, p_kind, p_guide_id);
    v_liked := true;
  end if;

  select count(*)::integer into v_count
  from public.guide_likes
  where guide_kind = p_kind and guide_id = p_guide_id;

  if p_kind = 'activities' then
    update public.curated_guides set like_count = v_count where id = p_guide_id;
  else
    update public.curated_event_guides set like_count = v_count where id = p_guide_id;
  end if;

  return jsonb_build_object('liked', v_liked, 'like_count', v_count);
end;
$$;

revoke all on function public.toggle_guide_like(text, uuid) from public, anon;
grant execute on function public.toggle_guide_like(text, uuid) to authenticated;

create or replace function public.record_guide_view(
  p_kind text,
  p_guide_id uuid,
  p_visitor_key text,
  p_viewed_on date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  if p_kind not in ('activities', 'events')
    or p_guide_id is null
    or p_visitor_key is null
    or length(p_visitor_key) > 64
    or p_viewed_on is null then
    return false;
  end if;

  insert into public.guide_view_days (guide_kind, guide_id, visitor_key, viewed_on)
  values (p_kind, p_guide_id, p_visitor_key, p_viewed_on)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  if p_kind = 'activities' then
    update public.curated_guides
    set view_count = view_count + 1
    where id = p_guide_id;
  else
    update public.curated_event_guides
    set view_count = view_count + 1
    where id = p_guide_id;
  end if;
  return true;
end;
$$;

revoke all on function public.record_guide_view(text, uuid, text, date) from public, anon, authenticated;
