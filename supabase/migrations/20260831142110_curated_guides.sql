-- Curated Guides: staff-authored lists of live directory listings.
-- Roles stay in auth.users raw_app_meta_data (JWT app_metadata.role).

do $$ begin
  create type public.curated_guide_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create or replace function public.curated_guide_is_live(
  p_status public.curated_guide_status,
  p_publish_at timestamptz,
  p_expire_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status = 'published'
    and (p_publish_at is null or p_publish_at <= now())
    and (p_expire_at is null or p_expire_at > now());
$$;

create table if not exists public.curated_guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  intro text,
  status public.curated_guide_status not null default 'draft',
  publish_at timestamptz,
  expire_at timestamptz,
  duplicated_from_id uuid references public.curated_guides (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curated_guides_slug_unique unique (slug),
  constraint curated_guides_dates_ok check (
    expire_at is null or publish_at is null or expire_at > publish_at
  )
);

create index if not exists curated_guides_live_idx
  on public.curated_guides (status, publish_at desc, updated_at desc);

create table if not exists public.curated_guide_items (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.curated_guides (id) on delete cascade,
  listing_id uuid not null references public.directory_listings (id) on delete cascade,
  item_kind text not null default 'listing',
  sort_order int not null default 0,
  editorial_note text,
  created_at timestamptz not null default now(),
  constraint curated_guide_items_kind_check check (item_kind in ('listing', 'event', 'community')),
  constraint curated_guide_items_unique unique (guide_id, listing_id)
);

create index if not exists curated_guide_items_guide_idx
  on public.curated_guide_items (guide_id, sort_order);

create table if not exists public.curated_guide_interests (
  guide_id uuid not null references public.curated_guides (id) on delete cascade,
  interest_id uuid not null references public.interests (id) on delete cascade,
  primary key (guide_id, interest_id)
);

alter table public.curated_guides enable row level security;
alter table public.curated_guide_items enable row level security;
alter table public.curated_guide_interests enable row level security;

create policy "Public can read live curated guides"
  on public.curated_guides
  for select
  to anon, authenticated
  using (
    public.curated_guide_is_live(status, publish_at, expire_at)
    or public.is_staff()
  );

create policy "Public can read live curated guide items"
  on public.curated_guide_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.curated_guides g
      where g.id = guide_id
        and (
          public.curated_guide_is_live(g.status, g.publish_at, g.expire_at)
          or public.is_staff()
        )
    )
  );

create policy "Public can read live curated guide interests"
  on public.curated_guide_interests
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.curated_guides g
      where g.id = guide_id
        and (
          public.curated_guide_is_live(g.status, g.publish_at, g.expire_at)
          or public.is_staff()
        )
    )
  );

grant select on public.curated_guides to anon, authenticated;
grant select on public.curated_guide_items to anon, authenticated;
grant select on public.curated_guide_interests to anon, authenticated;

create or replace function private.unique_guide_slug(p_title text, p_exclude uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
  v_n int := 2;
begin
  v_base := public.slugify(p_title);
  if v_base is null or v_base = '' then
    v_base := 'guide';
  end if;
  v_slug := v_base;
  while exists (
    select 1
    from public.curated_guides
    where slug = v_slug
      and (p_exclude is null or id is distinct from p_exclude)
  ) loop
    v_slug := v_base || '-' || v_n::text;
    v_n := v_n + 1;
  end loop;
  return v_slug;
end;
$$;

create or replace function private.require_guide_admin()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_role is distinct from 'admin' then
    raise exception 'Control Room actions are for admins';
  end if;
  return v_actor;
end;
$$;

create or replace function private.save_curated_guide_contents(
  p_guide_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_interest uuid;
  v_listing uuid;
  v_kind text;
  v_order int := 0;
  v_seen uuid[] := '{}';
begin
  delete from public.curated_guide_items where guide_id = p_guide_id;
  delete from public.curated_guide_interests where guide_id = p_guide_id;

  for v_interest in
    select (value #>> '{}')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'interest_ids', '[]'::jsonb))
  loop
    if v_interest is null then
      continue;
    end if;
    if not exists (select 1 from public.interests where id = v_interest) then
      raise exception 'Unknown interest';
    end if;
    insert into public.curated_guide_interests (guide_id, interest_id)
    values (p_guide_id, v_interest)
    on conflict do nothing;
  end loop;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb))
  loop
    v_kind := coalesce(nullif(btrim(coalesce(v_item ->> 'item_kind', '')), ''), 'listing');
    if v_kind is distinct from 'listing' then
      raise exception 'Guides can only include directory listings for now';
    end if;
    begin
      v_listing := (v_item ->> 'listing_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Each recommendation needs a listing';
    end;
    if v_listing is null then
      raise exception 'Each recommendation needs a listing';
    end if;
    if v_listing = any (v_seen) then
      continue;
    end if;
    if not exists (select 1 from public.directory_listings where id = v_listing) then
      raise exception 'Listing not found';
    end if;
    insert into public.curated_guide_items (
      guide_id, listing_id, item_kind, sort_order, editorial_note
    ) values (
      p_guide_id,
      v_listing,
      'listing',
      coalesce((v_item ->> 'sort_order')::int, v_order),
      nullif(btrim(coalesce(v_item ->> 'editorial_note', '')), '')
    );
    v_seen := array_append(v_seen, v_listing);
    v_order := v_order + 1;
  end loop;
end;
$$;

create or replace function private.create_curated_guide()
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_row public.curated_guides;
begin
  insert into public.curated_guides (
    title, slug, status, created_by, updated_by
  ) values (
    'Untitled Guide',
    private.unique_guide_slug('Untitled Guide', null),
    'draft',
    v_actor,
    v_actor
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function private.save_curated_guide(
  p_guide_id uuid,
  p_payload jsonb
)
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_title text;
  v_slug text;
  v_intro text;
  v_publish timestamptz;
  v_expire timestamptz;
  v_after public.curated_guides;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Save payload required';
  end if;

  if not exists (select 1 from public.curated_guides where id = p_guide_id) then
    raise exception 'Guide not found';
  end if;

  v_title := btrim(coalesce(p_payload ->> 'title', ''));
  if v_title = '' then
    raise exception 'Guide title is required';
  end if;

  v_intro := nullif(btrim(coalesce(p_payload ->> 'intro', '')), '');
  v_publish := nullif(btrim(coalesce(p_payload ->> 'publish_at', '')), '')::timestamptz;
  v_expire := nullif(btrim(coalesce(p_payload ->> 'expire_at', '')), '')::timestamptz;
  if v_publish is not null and v_expire is not null and v_expire <= v_publish then
    raise exception 'Expiry must be after publish';
  end if;

  v_slug := public.slugify(coalesce(p_payload ->> 'slug', v_title));
  if v_slug is null or v_slug = '' then
    v_slug := private.unique_guide_slug(v_title, p_guide_id);
  else
    if exists (
      select 1 from public.curated_guides
      where slug = v_slug and id is distinct from p_guide_id
    ) then
      v_slug := private.unique_guide_slug(v_slug, p_guide_id);
    end if;
  end if;

  update public.curated_guides
  set
    title = v_title,
    slug = v_slug,
    intro = v_intro,
    publish_at = v_publish,
    expire_at = v_expire,
    updated_by = v_actor,
    updated_at = now()
  where id = p_guide_id
  returning * into v_after;

  perform private.save_curated_guide_contents(p_guide_id, p_payload);
  return v_after;
end;
$$;

create or replace function private.apply_guide_action(
  p_guide_id uuid,
  p_action text
)
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_before public.curated_guides;
  v_after public.curated_guides;
  v_items int;
begin
  if p_action not in ('publish', 'unpublish', 'archive') then
    raise exception 'Unknown action';
  end if;

  select * into v_before
  from public.curated_guides
  where id = p_guide_id
  for update;

  if not found then
    raise exception 'Guide not found';
  end if;

  if p_action = 'publish' then
    if btrim(v_before.title) = '' or v_before.title = 'Untitled Guide' then
      raise exception 'Give the guide a title before publishing';
    end if;
    select count(*) into v_items
    from public.curated_guide_items
    where guide_id = p_guide_id;
    if v_items < 1 then
      raise exception 'Add at least one recommendation before publishing';
    end if;
    update public.curated_guides
    set
      status = 'published',
      updated_by = v_actor,
      updated_at = now()
    where id = p_guide_id
    returning * into v_after;
  elsif p_action = 'unpublish' then
    update public.curated_guides
    set
      status = 'draft',
      updated_by = v_actor,
      updated_at = now()
    where id = p_guide_id
    returning * into v_after;
  else
    update public.curated_guides
    set
      status = 'archived',
      updated_by = v_actor,
      updated_at = now()
    where id = p_guide_id
    returning * into v_after;
  end if;

  return v_after;
end;
$$;

create or replace function private.duplicate_curated_guide(p_guide_id uuid)
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_source public.curated_guides;
  v_row public.curated_guides;
begin
  select * into v_source
  from public.curated_guides
  where id = p_guide_id;

  if not found then
    raise exception 'Guide not found';
  end if;

  insert into public.curated_guides (
    title, slug, intro, status, publish_at, expire_at,
    duplicated_from_id, created_by, updated_by
  ) values (
    v_source.title,
    private.unique_guide_slug(v_source.title, null),
    v_source.intro,
    'draft',
    v_source.publish_at,
    v_source.expire_at,
    v_source.id,
    v_actor,
    v_actor
  )
  returning * into v_row;

  insert into public.curated_guide_items (
    guide_id, listing_id, item_kind, sort_order, editorial_note
  )
  select v_row.id, listing_id, item_kind, sort_order, editorial_note
  from public.curated_guide_items
  where guide_id = p_guide_id
  order by sort_order;

  insert into public.curated_guide_interests (guide_id, interest_id)
  select v_row.id, interest_id
  from public.curated_guide_interests
  where guide_id = p_guide_id;

  return v_row;
end;
$$;

create or replace function public.admin_create_curated_guide()
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_curated_guide();
end;
$$;

create or replace function public.admin_save_curated_guide(
  p_guide_id uuid,
  p_payload jsonb
)
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.save_curated_guide(p_guide_id, p_payload);
end;
$$;

create or replace function public.admin_apply_guide_action(
  p_guide_id uuid,
  p_action text
)
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.apply_guide_action(p_guide_id, p_action);
end;
$$;

create or replace function public.admin_duplicate_curated_guide(p_guide_id uuid)
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.duplicate_curated_guide(p_guide_id);
end;
$$;

revoke all on function public.admin_create_curated_guide() from public, anon;
grant execute on function public.admin_create_curated_guide() to authenticated;

revoke all on function public.admin_save_curated_guide(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_curated_guide(uuid, jsonb) to authenticated;

revoke all on function public.admin_apply_guide_action(uuid, text) from public, anon;
grant execute on function public.admin_apply_guide_action(uuid, text) to authenticated;

revoke all on function public.admin_duplicate_curated_guide(uuid) from public, anon;
grant execute on function public.admin_duplicate_curated_guide(uuid) to authenticated;
