-- Guides as one reading product: authors, shape, body.
-- Roles stay in auth.users raw_app_meta_data. Local only unless applied.

do $$ begin
  create type public.curated_guide_shape as enum ('roundup', 'spotlight');
exception when duplicate_object then null;
end $$;

create table if not exists public.guide_authors (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  slug text not null,
  tagline text,
  bio text,
  photo_url text,
  photo_storage_key text,
  instagram_url text,
  tiktok_url text,
  facebook_url text,
  website_url text,
  user_id uuid unique references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_authors_slug_unique unique (slug),
  constraint guide_authors_name_ok check (btrim(display_name) <> '')
);

create index if not exists guide_authors_name_idx on public.guide_authors (display_name);

alter table public.curated_guides
  add column if not exists shape public.curated_guide_shape not null default 'roundup',
  add column if not exists body text,
  add column if not exists author_id uuid references public.guide_authors (id) on delete set null;

alter table public.curated_event_guides
  add column if not exists shape public.curated_guide_shape not null default 'roundup',
  add column if not exists body text,
  add column if not exists author_id uuid references public.guide_authors (id) on delete set null;

create index if not exists curated_guides_author_idx on public.curated_guides (author_id);
create index if not exists curated_event_guides_author_idx on public.curated_event_guides (author_id);

alter table public.guide_authors enable row level security;

drop policy if exists guide_authors_read on public.guide_authors;
create policy guide_authors_read
  on public.guide_authors
  for select
  to anon, authenticated
  using (true);

drop policy if exists guide_authors_staff_write on public.guide_authors;
create policy guide_authors_staff_write
  on public.guide_authors
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select on public.guide_authors to anon, authenticated;
grant insert, update, delete on public.guide_authors to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guide-authors',
  'guide-authors',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = coalesce(storage.buckets.file_size_limit, excluded.file_size_limit),
  allowed_mime_types = coalesce(storage.buckets.allowed_mime_types, excluded.allowed_mime_types);

drop policy if exists guide_authors_media_select on storage.objects;
create policy guide_authors_media_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'guide-authors');

drop policy if exists guide_authors_media_insert on storage.objects;
create policy guide_authors_media_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'guide-authors'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );

drop policy if exists guide_authors_media_update on storage.objects;
create policy guide_authors_media_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'guide-authors'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  )
  with check (
    bucket_id = 'guide-authors'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );

drop policy if exists guide_authors_media_delete on storage.objects;
create policy guide_authors_media_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'guide-authors'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );

create or replace function private.require_guide_staff()
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
  if v_role not in ('admin', 'editor') then
    raise exception 'Control Room actions are for staff';
  end if;
  return v_actor;
end;
$$;

create or replace function private.linked_guide_author(p_user uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select id from public.guide_authors where user_id = p_user limit 1;
$$;

create or replace function private.assert_guide_edit(p_created_by uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_actor uuid := (select auth.uid());
begin
  if v_role = 'admin' then
    return;
  end if;
  if v_actor is null or p_created_by is distinct from v_actor then
    raise exception 'You can only edit your own drafts';
  end if;
end;
$$;

create or replace function private.guide_slug_taken(p_slug text, p_exclude uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.curated_guides
    where slug = p_slug and (p_exclude is null or id is distinct from p_exclude)
  ) or exists (
    select 1 from public.curated_event_guides
    where slug = p_slug and (p_exclude is null or id is distinct from p_exclude)
  );
$$;

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
  while private.guide_slug_taken(v_slug, p_exclude) loop
    v_slug := v_base || '-' || v_n::text;
    v_n := v_n + 1;
  end loop;
  return v_slug;
end;
$$;

create or replace function private.unique_event_guide_slug(p_title text, p_exclude uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.unique_guide_slug(p_title, p_exclude);
end;
$$;

create or replace function private.unique_author_slug(p_name text, p_exclude uuid default null)
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
  v_base := public.slugify(p_name);
  if v_base is null or v_base = '' then
    v_base := 'author';
  end if;
  v_slug := v_base;
  while exists (
    select 1 from public.guide_authors
    where slug = v_slug and (p_exclude is null or id is distinct from p_exclude)
  ) loop
    v_slug := v_base || '-' || v_n::text;
    v_n := v_n + 1;
  end loop;
  return v_slug;
end;
$$;

create or replace function private.resolve_guide_author(p_payload jsonb, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_author uuid;
  v_linked uuid := private.linked_guide_author(p_actor);
begin
  begin
    v_author := nullif(btrim(coalesce(p_payload ->> 'author_id', '')), '')::uuid;
  exception when invalid_text_representation then
    v_author := null;
  end;
  if v_author is not null and not exists (select 1 from public.guide_authors where id = v_author) then
    v_author := null;
  end if;
  if v_role is distinct from 'admin' then
    return v_linked;
  end if;
  return v_author;
end;
$$;

create or replace function private.resolve_guide_shape(p_payload jsonb)
returns public.curated_guide_shape
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_raw text := lower(btrim(coalesce(p_payload ->> 'shape', 'roundup')));
begin
  if v_raw = 'spotlight' then
    return 'spotlight'::public.curated_guide_shape;
  end if;
  return 'roundup'::public.curated_guide_shape;
end;
$$;

create or replace function private.create_curated_guide()
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_staff();
  v_row public.curated_guides;
begin
  insert into public.curated_guides (
    title, slug, status, author_id, created_by, updated_by
  ) values (
    'Untitled Guide',
    private.unique_guide_slug('Untitled Guide', null),
    'draft',
    private.linked_guide_author(v_actor),
    v_actor,
    v_actor
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function private.create_curated_event_guide()
returns public.curated_event_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_staff();
  v_row public.curated_event_guides;
begin
  insert into public.curated_event_guides (
    title, slug, status, author_id, created_by, updated_by
  ) values (
    'Untitled Event Guide',
    private.unique_event_guide_slug('Untitled Event Guide', null),
    'draft',
    private.linked_guide_author(v_actor),
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
  v_actor uuid := private.require_guide_staff();
  v_title text;
  v_slug text;
  v_intro text;
  v_body text;
  v_publish timestamptz;
  v_expire timestamptz;
  v_scale uuid;
  v_shape public.curated_guide_shape;
  v_author uuid;
  v_after public.curated_guides;
  v_created uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Save payload required';
  end if;

  select created_by into v_created
  from public.curated_guides
  where id = p_guide_id;
  if not found then
    raise exception 'Guide not found';
  end if;
  perform private.assert_guide_edit(v_created);

  v_title := btrim(coalesce(p_payload ->> 'title', ''));
  if v_title = '' then
    raise exception 'Guide title is required';
  end if;

  v_intro := nullif(btrim(coalesce(p_payload ->> 'intro', '')), '');
  v_body := nullif(btrim(coalesce(p_payload ->> 'body', '')), '');
  v_publish := nullif(btrim(coalesce(p_payload ->> 'publish_at', '')), '')::timestamptz;
  v_expire := nullif(btrim(coalesce(p_payload ->> 'expire_at', '')), '')::timestamptz;
  if v_publish is not null and v_expire is not null and v_expire <= v_publish then
    raise exception 'Expiry must be after publish';
  end if;

  begin
    v_scale := nullif(btrim(coalesce(p_payload ->> 'scale_id', '')), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Unknown adventure level';
  end;
  if v_scale is not null and not exists (select 1 from public.activity_scales where id = v_scale) then
    raise exception 'Unknown adventure level';
  end if;

  v_shape := private.resolve_guide_shape(p_payload);
  v_author := private.resolve_guide_author(p_payload, v_actor);

  v_slug := public.slugify(coalesce(p_payload ->> 'slug', v_title));
  if v_slug is null or v_slug = '' then
    v_slug := private.unique_guide_slug(v_title, p_guide_id);
  else
    if private.guide_slug_taken(v_slug, p_guide_id) then
      v_slug := private.unique_guide_slug(v_slug, p_guide_id);
    end if;
  end if;

  update public.curated_guides
  set
    title = v_title,
    slug = v_slug,
    intro = v_intro,
    body = v_body,
    shape = v_shape,
    author_id = v_author,
    publish_at = v_publish,
    expire_at = v_expire,
    scale_id = v_scale,
    updated_by = v_actor,
    updated_at = now()
  where id = p_guide_id
  returning * into v_after;

  perform private.save_curated_guide_contents(p_guide_id, p_payload);
  perform private.save_curated_guide_audience(p_guide_id, p_payload);
  return v_after;
end;
$$;

create or replace function private.save_curated_event_guide(
  p_guide_id uuid,
  p_payload jsonb
)
returns public.curated_event_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_staff();
  v_title text;
  v_slug text;
  v_intro text;
  v_body text;
  v_publish timestamptz;
  v_expire timestamptz;
  v_price int;
  v_place uuid;
  v_interests text[];
  v_personas text[];
  v_ranks int[];
  v_shape public.curated_guide_shape;
  v_author uuid;
  v_after public.curated_event_guides;
  v_created uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Save payload required';
  end if;

  select created_by into v_created
  from public.curated_event_guides
  where id = p_guide_id;
  if not found then
    raise exception 'Event guide not found';
  end if;
  perform private.assert_guide_edit(v_created);

  v_title := btrim(coalesce(p_payload ->> 'title', ''));
  if v_title = '' then
    raise exception 'Guide title is required';
  end if;

  v_intro := nullif(btrim(coalesce(p_payload ->> 'intro', '')), '');
  v_body := nullif(btrim(coalesce(p_payload ->> 'body', '')), '');
  v_publish := nullif(btrim(coalesce(p_payload ->> 'publish_at', '')), '')::timestamptz;
  v_expire := nullif(btrim(coalesce(p_payload ->> 'expire_at', '')), '')::timestamptz;
  if v_publish is not null and v_expire is not null and v_expire <= v_publish then
    raise exception 'Expiry must be after publish';
  end if;

  begin
    v_price := nullif(btrim(coalesce(p_payload ->> 'max_price_cents', '')), '')::int;
  exception when invalid_text_representation then
    v_price := null;
  end;
  if v_price is not null and v_price <= 0 then
    v_price := null;
  end if;

  begin
    v_place := nullif(btrim(coalesce(p_payload ->> 'place_id', '')), '')::uuid;
  exception when invalid_text_representation then
    v_place := null;
  end;
  if v_place is not null and not exists (select 1 from public.places where id = v_place) then
    v_place := null;
  end if;

  select coalesce(array_agg(btrim(value #>> '{}')), '{}')
    into v_interests
  from jsonb_array_elements(coalesce(p_payload -> 'interest_labels', '[]'::jsonb))
  where btrim(coalesce(value #>> '{}', '')) <> '';

  select coalesce(array_agg(btrim(value #>> '{}')), '{}')
    into v_personas
  from jsonb_array_elements(coalesce(p_payload -> 'persona_labels', '[]'::jsonb))
  where btrim(coalesce(value #>> '{}', '')) <> '';

  select coalesce(array_agg((value #>> '{}')::int), '{}')
    into v_ranks
  from jsonb_array_elements(coalesce(p_payload -> 'energy_ranks', '[]'::jsonb))
  where (value #>> '{}') ~ '^[1-5]$';

  v_shape := private.resolve_guide_shape(p_payload);
  v_author := private.resolve_guide_author(p_payload, v_actor);

  v_slug := public.slugify(coalesce(p_payload ->> 'slug', v_title));
  if v_slug is null or v_slug = '' then
    v_slug := private.unique_event_guide_slug(v_title, p_guide_id);
  else
    if private.guide_slug_taken(v_slug, p_guide_id) then
      v_slug := private.unique_event_guide_slug(v_slug, p_guide_id);
    end if;
  end if;

  update public.curated_event_guides
  set
    title = v_title,
    slug = v_slug,
    intro = v_intro,
    body = v_body,
    shape = v_shape,
    author_id = v_author,
    publish_at = v_publish,
    expire_at = v_expire,
    max_price_cents = v_price,
    place_id = v_place,
    interest_labels = coalesce(v_interests, '{}'),
    persona_labels = coalesce(v_personas, '{}'),
    energy_ranks = coalesce(v_ranks, '{}'),
    updated_by = v_actor,
    updated_at = now()
  where id = p_guide_id
  returning * into v_after;

  perform private.save_curated_event_guide_contents(p_guide_id, p_payload);
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
    if v_before.shape = 'spotlight' and v_items <> 1 then
      raise exception 'A spotlight needs exactly one activity';
    end if;
    update public.curated_guides
    set status = 'published', updated_by = v_actor, updated_at = now()
    where id = p_guide_id
    returning * into v_after;
  elsif p_action = 'unpublish' then
    update public.curated_guides
    set status = 'draft', updated_by = v_actor, updated_at = now()
    where id = p_guide_id
    returning * into v_after;
  else
    update public.curated_guides
    set status = 'archived', updated_by = v_actor, updated_at = now()
    where id = p_guide_id
    returning * into v_after;
  end if;

  return v_after;
end;
$$;

create or replace function private.apply_event_guide_action(
  p_guide_id uuid,
  p_action text
)
returns public.curated_event_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_before public.curated_event_guides;
  v_after public.curated_event_guides;
  v_items int;
begin
  if p_action not in ('publish', 'unpublish', 'archive') then
    raise exception 'Unknown action';
  end if;

  select * into v_before
  from public.curated_event_guides
  where id = p_guide_id
  for update;

  if not found then
    raise exception 'Event guide not found';
  end if;

  if p_action = 'publish' then
    if btrim(v_before.title) = '' or v_before.title = 'Untitled Event Guide' then
      raise exception 'Give the guide a title before publishing';
    end if;
    select count(*) into v_items
    from public.curated_event_guide_items
    where guide_id = p_guide_id;
    if v_items < 1 then
      raise exception 'Add at least one recommendation before publishing';
    end if;
    if v_before.shape = 'spotlight' and v_items <> 1 then
      raise exception 'A spotlight needs exactly one event';
    end if;
    update public.curated_event_guides
    set status = 'published', updated_by = v_actor, updated_at = now()
    where id = p_guide_id
    returning * into v_after;
  elsif p_action = 'unpublish' then
    update public.curated_event_guides
    set status = 'draft', updated_by = v_actor, updated_at = now()
    where id = p_guide_id
    returning * into v_after;
  else
    update public.curated_event_guides
    set status = 'archived', updated_by = v_actor, updated_at = now()
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
  v_actor uuid := private.require_guide_staff();
  v_source public.curated_guides;
  v_row public.curated_guides;
  v_author uuid;
begin
  select * into v_source
  from public.curated_guides
  where id = p_guide_id;

  if not found then
    raise exception 'Guide not found';
  end if;

  v_author := coalesce(private.linked_guide_author(v_actor), v_source.author_id);

  insert into public.curated_guides (
    title, slug, intro, body, shape, author_id, status, publish_at, expire_at, scale_id,
    duplicated_from_id, created_by, updated_by
  ) values (
    v_source.title,
    private.unique_guide_slug(v_source.title, null),
    v_source.intro,
    v_source.body,
    v_source.shape,
    v_author,
    'draft',
    v_source.publish_at,
    v_source.expire_at,
    v_source.scale_id,
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

  insert into public.curated_guide_activity_kinds (guide_id, activity_kind_id)
  select v_row.id, activity_kind_id
  from public.curated_guide_activity_kinds
  where guide_id = p_guide_id;

  insert into public.curated_guide_personas (guide_id, persona_id)
  select v_row.id, persona_id
  from public.curated_guide_personas
  where guide_id = p_guide_id;

  return v_row;
end;
$$;

create or replace function private.duplicate_curated_event_guide(p_guide_id uuid)
returns public.curated_event_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_staff();
  v_source public.curated_event_guides;
  v_row public.curated_event_guides;
  v_author uuid;
begin
  select * into v_source
  from public.curated_event_guides
  where id = p_guide_id;

  if not found then
    raise exception 'Event guide not found';
  end if;

  v_author := coalesce(private.linked_guide_author(v_actor), v_source.author_id);

  insert into public.curated_event_guides (
    title, slug, intro, body, shape, author_id, status, publish_at, expire_at,
    max_price_cents, place_id, interest_labels, persona_labels, energy_ranks,
    duplicated_from_id, created_by, updated_by
  ) values (
    v_source.title,
    private.unique_event_guide_slug(v_source.title, null),
    v_source.intro,
    v_source.body,
    v_source.shape,
    v_author,
    'draft',
    v_source.publish_at,
    v_source.expire_at,
    v_source.max_price_cents,
    v_source.place_id,
    v_source.interest_labels,
    v_source.persona_labels,
    v_source.energy_ranks,
    v_source.id,
    v_actor,
    v_actor
  )
  returning * into v_row;

  insert into public.curated_event_guide_items (
    guide_id, event_id, sort_order, editorial_note
  )
  select v_row.id, event_id, sort_order, editorial_note
  from public.curated_event_guide_items
  where guide_id = p_guide_id
  order by sort_order;

  return v_row;
end;
$$;

create or replace function public.admin_create_guide_author()
returns public.guide_authors
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_row public.guide_authors;
begin
  insert into public.guide_authors (
    display_name, slug, created_by, updated_by
  ) values (
    'Untitled Author',
    private.unique_author_slug('Untitled Author', null),
    v_actor,
    v_actor
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.admin_save_guide_author(
  p_author_id uuid,
  p_payload jsonb
)
returns public.guide_authors
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_name text;
  v_slug text;
  v_user uuid;
  v_after public.guide_authors;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Save payload required';
  end if;
  if not exists (select 1 from public.guide_authors where id = p_author_id) then
    raise exception 'Author not found';
  end if;

  v_name := btrim(coalesce(p_payload ->> 'display_name', ''));
  if v_name = '' or v_name = 'Untitled Author' then
    raise exception 'Author name is required';
  end if;

  begin
    v_user := nullif(btrim(coalesce(p_payload ->> 'user_id', '')), '')::uuid;
  exception when invalid_text_representation then
    v_user := null;
  end;
  if v_user is not null and not exists (select 1 from auth.users where id = v_user) then
    raise exception 'Unknown staff user';
  end if;

  v_slug := public.slugify(coalesce(p_payload ->> 'slug', v_name));
  if v_slug is null or v_slug = '' then
    v_slug := private.unique_author_slug(v_name, p_author_id);
  else
    if exists (
      select 1 from public.guide_authors
      where slug = v_slug and id is distinct from p_author_id
    ) then
      v_slug := private.unique_author_slug(v_slug, p_author_id);
    end if;
  end if;

  update public.guide_authors
  set
    display_name = v_name,
    slug = v_slug,
    tagline = nullif(btrim(coalesce(p_payload ->> 'tagline', '')), ''),
    bio = nullif(btrim(coalesce(p_payload ->> 'bio', '')), ''),
    photo_url = nullif(btrim(coalesce(p_payload ->> 'photo_url', '')), ''),
    photo_storage_key = nullif(btrim(coalesce(p_payload ->> 'photo_storage_key', '')), ''),
    instagram_url = nullif(btrim(coalesce(p_payload ->> 'instagram_url', '')), ''),
    tiktok_url = nullif(btrim(coalesce(p_payload ->> 'tiktok_url', '')), ''),
    facebook_url = nullif(btrim(coalesce(p_payload ->> 'facebook_url', '')), ''),
    website_url = nullif(btrim(coalesce(p_payload ->> 'website_url', '')), ''),
    user_id = v_user,
    updated_by = v_actor,
    updated_at = now()
  where id = p_author_id
  returning * into v_after;

  return v_after;
end;
$$;

create or replace function public.admin_list_guide_staff()
returns table (
  id uuid,
  email text,
  display_name text,
  role text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_guide_admin();
  return query
  select
    u.id,
    u.email::text,
    coalesce(nullif(btrim(p.display_name), ''), split_part(u.email::text, '@', 1)) as display_name,
    coalesce(u.raw_app_meta_data ->> 'role', '') as role
  from auth.users u
  left join public.profiles p on p.id = u.id
  where coalesce(u.raw_app_meta_data ->> 'role', '') in ('admin', 'editor')
  order by display_name;
end;
$$;

revoke all on function public.admin_create_guide_author() from public, anon;
grant execute on function public.admin_create_guide_author() to authenticated;
revoke all on function public.admin_save_guide_author(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_guide_author(uuid, jsonb) to authenticated;
revoke all on function public.admin_list_guide_staff() from public, anon;
grant execute on function public.admin_list_guide_staff() to authenticated;
