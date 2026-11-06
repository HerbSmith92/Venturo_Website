-- Keep placeholder slugs (untitled-guide, untitled-guide-3) from becoming the public URL
-- once a real title exists. Preserve submit / request-changes / published_snapshot.

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
  v_places uuid[];
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

  select coalesce(array_agg(p.id), '{}')
    into v_places
  from jsonb_array_elements_text(coalesce(p_payload -> 'place_ids', '[]'::jsonb)) elem
  join public.places p on p.id::text = btrim(elem);

  v_shape := private.resolve_guide_shape(p_payload);
  v_author := private.resolve_guide_author(p_payload, v_actor);

  v_slug := public.slugify(coalesce(p_payload ->> 'slug', v_title));
  if v_slug is null or v_slug = '' or v_slug ~* '^untitled-guide(-[0-9]+)?$' then
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
    place_ids = coalesce(v_places, '{}'),
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
  v_actor uuid;
  v_before public.curated_guides;
  v_after public.curated_guides;
  v_items int;
  v_slug text;
begin
  if p_action not in ('publish', 'unpublish', 'archive', 'submit', 'request_changes') then
    raise exception 'Unknown action';
  end if;

  if p_action in ('submit') then
    v_actor := private.require_guide_staff();
  else
    v_actor := private.require_guide_admin();
  end if;

  select * into v_before
  from public.curated_guides
  where id = p_guide_id
  for update;
  if not found then
    raise exception 'Guide not found';
  end if;

  if p_action = 'submit' then
    perform private.assert_guide_edit(v_before.created_by);
    if btrim(v_before.title) = '' or v_before.title = 'Untitled Guide' then
      raise exception 'Give the guide a title before submitting';
    end if;
    if v_before.shape = 'spotlight' and v_before.listing_id is null then
      raise exception 'Link an activity before submitting';
    end if;
    update public.curated_guides
    set status = 'review', review_note = null, updated_by = v_actor, updated_at = now()
    where id = p_guide_id
    returning * into v_after;
    return v_after;
  end if;

  if p_action = 'request_changes' then
    update public.curated_guides
    set status = 'changes', updated_by = v_actor, updated_at = now()
    where id = p_guide_id
    returning * into v_after;
    return v_after;
  end if;

  if p_action = 'publish' then
    if btrim(v_before.title) = '' or v_before.title = 'Untitled Guide' then
      raise exception 'Give the guide a title before publishing';
    end if;
    select count(*) into v_items
    from public.curated_guide_items
    where guide_id = p_guide_id;
    if v_items < 1 then
      raise exception 'Add at least one activity before publishing';
    end if;
    if v_before.shape = 'spotlight' and v_items <> 1 then
      raise exception 'A Spotlight needs exactly one activity';
    end if;
    v_slug := v_before.slug;
    if v_slug ~* '^untitled-guide(-[0-9]+)?$' then
      v_slug := private.unique_guide_slug(v_before.title, p_guide_id);
    end if;
    update public.curated_guides
    set
      status = 'published',
      slug = v_slug,
      published_snapshot = jsonb_build_object(
        'title', title,
        'intro', intro,
        'slug', v_slug,
        'story', story,
        'photos', photos,
        'cover', cover,
        'listing_id', listing_id,
        'author_id', author_id,
        'body', body
      ),
      updated_by = v_actor,
      updated_at = now()
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

do $$
declare
  r record;
  v_slug text;
begin
  for r in
    select id, title
    from public.curated_guides
    where slug ~* '^untitled-guide(-[0-9]+)?$'
      and btrim(title) <> ''
      and title is distinct from 'Untitled Guide'
  loop
    v_slug := private.unique_guide_slug(r.title, r.id);
    update public.curated_guides
    set
      slug = v_slug,
      published_snapshot = case
        when published_snapshot is null then published_snapshot
        else jsonb_set(published_snapshot, '{slug}', to_jsonb(v_slug), true)
      end
    where id = r.id;
  end loop;
end;
$$;
