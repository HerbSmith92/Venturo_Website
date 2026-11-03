-- Staff (admin & editor) can edit every Guide. Invited authors can only edit their own.

drop function if exists private.assert_guide_edit(uuid);

create function private.assert_guide_edit(p_created_by uuid, p_author_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_actor uuid := (select auth.uid());
begin
  if v_role in ('admin', 'editor') then
    return;
  end if;
  if v_actor is not null and p_created_by is not distinct from v_actor then
    return;
  end if;
  if v_actor is not null
     and p_author_id is not null
     and p_author_id is not distinct from private.linked_guide_author(v_actor) then
    return;
  end if;
  raise exception 'You can only edit your own guides';
end;
$$;

create or replace function private.save_curated_guide(p_guide_id uuid, p_payload jsonb)
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
  v_listing uuid;
  v_after public.curated_guides;
  v_created uuid;
  v_existing_author uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Save payload required';
  end if;

  select created_by, author_id into v_created, v_existing_author
  from public.curated_guides
  where id = p_guide_id;
  if not found then
    raise exception 'Guide not found';
  end if;
  perform private.assert_guide_edit(v_created, v_existing_author);

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

  begin
    v_listing := nullif(btrim(coalesce(p_payload ->> 'listing_id', '')), '')::uuid;
  exception when invalid_text_representation then
    v_listing := null;
  end;
  if v_listing is not null and not exists (select 1 from public.directory_listings where id = v_listing) then
    raise exception 'Unknown activity';
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
    listing_id = v_listing,
    story = coalesce(p_payload -> 'story', story),
    photos = coalesce(p_payload -> 'photos', photos),
    cover = coalesce(p_payload -> 'cover', cover),
    publish_at = v_publish,
    expire_at = v_expire,
    scale_id = v_scale,
    updated_by = v_actor,
    updated_at = now()
  where id = p_guide_id
  returning * into v_after;

  if v_shape = 'spotlight' and v_listing is not null then
    delete from public.curated_guide_items where guide_id = p_guide_id;
    insert into public.curated_guide_items (guide_id, listing_id, sort_order, item_kind)
    values (p_guide_id, v_listing, 0, 'listing');
  else
    perform private.save_curated_guide_contents(p_guide_id, p_payload);
  end if;
  perform private.save_curated_guide_audience(p_guide_id, p_payload);
  return v_after;
end;
$$;

create or replace function private.save_curated_event_guide(p_guide_id uuid, p_payload jsonb)
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
  v_existing_author uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Save payload required';
  end if;

  select created_by, author_id into v_created, v_existing_author
  from public.curated_event_guides
  where id = p_guide_id;
  if not found then
    raise exception 'Event guide not found';
  end if;
  perform private.assert_guide_edit(v_created, v_existing_author);

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
  perform private.assert_guide_edit(v_source.created_by, v_source.author_id);

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
  perform private.assert_guide_edit(v_source.created_by, v_source.author_id);

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

create or replace function public.admin_save_guide_carousel(p_guide_id uuid, p_draft jsonb)
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_staff();
  v_row public.curated_guides;
  v_created uuid;
  v_author uuid;
begin
  if p_guide_id is null then
    raise exception 'Guide is required';
  end if;
  select created_by, author_id into v_created, v_author
  from public.curated_guides
  where id = p_guide_id;
  if not found then
    raise exception 'Guide not found';
  end if;
  perform private.assert_guide_edit(v_created, v_author);
  update public.curated_guides
  set
    carousel_draft = p_draft,
    updated_at = now(),
    updated_by = v_actor
  where id = p_guide_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Guide not found';
  end if;
  return v_row;
end;
$$;
