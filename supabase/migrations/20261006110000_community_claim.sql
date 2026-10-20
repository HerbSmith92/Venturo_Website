alter table public.communities
  add column if not exists claimed_by uuid references auth.users (id) on delete set null,
  add column if not exists claimed_at timestamptz;

create index if not exists communities_claimed_by_idx
  on public.communities (claimed_by);

drop policy if exists communities_owner_read on public.communities;
create policy communities_owner_read
  on public.communities
  for select
  to authenticated
  using (claimed_by = (select auth.uid()));

drop policy if exists community_events_owner_insert on public.community_events;
create policy community_events_owner_insert
  on public.community_events
  for insert
  to authenticated
  with check (
    link_status in ('pending', 'approved')
    and exists (
      select 1 from public.communities c
      where c.id = community_id
        and (c.created_by = (select auth.uid()) or c.claimed_by = (select auth.uid()))
    )
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.organiser_id = (select auth.uid())
    )
  );

create or replace function public.claim_community(p_community_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_claimed uuid;
  v_status text;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;

  select claimed_by, status
  into v_claimed, v_status
  from public.communities
  where id = p_community_id;

  if not found then
    raise exception 'Community not found';
  end if;
  if v_status is distinct from 'published' then
    raise exception 'Only a published community can be claimed';
  end if;
  if v_claimed is not null and v_claimed is distinct from v_actor then
    raise exception 'This community is already claimed';
  end if;

  update public.communities
  set
    claimed_by = v_actor,
    claimed_at = coalesce(claimed_at, now()),
    updated_at = now()
  where id = p_community_id;
end;
$$;

create or replace function public.save_claimed_community(
  p_community_id uuid,
  p_title text,
  p_about text,
  p_areas text[],
  p_contact_email text,
  p_phone text,
  p_website_url text,
  p_instagram_url text,
  p_facebook_url text,
  p_tiktok_url text,
  p_founder_name text,
  p_founder_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_status text;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_title is null then
    raise exception 'A name is required';
  end if;

  select status into v_status
  from public.communities
  where id = p_community_id
    and claimed_by = v_actor;

  if not found then
    raise exception 'You can only edit a community you have claimed';
  end if;
  if v_status in ('archived', 'suspended') then
    raise exception 'This community is closed';
  end if;

  update public.communities
  set
    title = v_title,
    about = nullif(btrim(coalesce(p_about, '')), ''),
    areas = coalesce(p_areas, '{}'),
    place_label = nullif(array_to_string(coalesce(p_areas, '{}'), ' · '), ''),
    contact_email = nullif(btrim(coalesce(p_contact_email, '')), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    website_url = nullif(btrim(coalesce(p_website_url, '')), ''),
    instagram_url = nullif(btrim(coalesce(p_instagram_url, '')), ''),
    facebook_url = nullif(btrim(coalesce(p_facebook_url, '')), ''),
    tiktok_url = nullif(btrim(coalesce(p_tiktok_url, '')), ''),
    founder_name = nullif(btrim(coalesce(p_founder_name, '')), ''),
    founder_email = nullif(btrim(coalesce(p_founder_email, '')), ''),
    updated_by = v_actor,
    updated_at = now()
  where id = p_community_id;
end;
$$;

revoke all on function public.claim_community(uuid) from public, anon;
grant execute on function public.claim_community(uuid) to authenticated;

revoke all on function public.save_claimed_community(uuid, text, text, text[], text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_claimed_community(uuid, text, text, text[], text, text, text, text, text, text, text, text) to authenticated;
