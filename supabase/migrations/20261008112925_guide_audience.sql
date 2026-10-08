alter table public.curated_guides
  add column if not exists scale_id uuid references public.activity_scales (id) on delete set null;

create table if not exists public.curated_guide_activity_kinds (
  guide_id uuid not null references public.curated_guides (id) on delete cascade,
  activity_kind_id uuid not null references public.activity_kinds (id) on delete cascade,
  primary key (guide_id, activity_kind_id)
);

create table if not exists public.curated_guide_personas (
  guide_id uuid not null references public.curated_guides (id) on delete cascade,
  persona_id uuid not null references public.personas (id) on delete cascade,
  primary key (guide_id, persona_id)
);

alter table public.curated_guide_activity_kinds enable row level security;
alter table public.curated_guide_personas enable row level security;

drop policy if exists curated_guide_kinds_read on public.curated_guide_activity_kinds;
create policy curated_guide_kinds_read
  on public.curated_guide_activity_kinds
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

drop policy if exists curated_guide_kinds_staff_write on public.curated_guide_activity_kinds;
create policy curated_guide_kinds_staff_write
  on public.curated_guide_activity_kinds
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists curated_guide_personas_read on public.curated_guide_personas;
create policy curated_guide_personas_read
  on public.curated_guide_personas
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

drop policy if exists curated_guide_personas_staff_write on public.curated_guide_personas;
create policy curated_guide_personas_staff_write
  on public.curated_guide_personas
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select on public.curated_guide_activity_kinds to anon, authenticated;
grant select on public.curated_guide_personas to anon, authenticated;
grant insert, update, delete on public.curated_guide_activity_kinds to authenticated;
grant insert, update, delete on public.curated_guide_personas to authenticated;

create or replace function private.save_curated_guide_audience(
  p_guide_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  delete from public.curated_guide_activity_kinds where guide_id = p_guide_id;
  delete from public.curated_guide_personas where guide_id = p_guide_id;

  for v_id in
    select (value #>> '{}')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'kind_ids', '[]'::jsonb))
  loop
    if v_id is null then
      continue;
    end if;
    if not exists (select 1 from public.activity_kinds where id = v_id) then
      raise exception 'Unknown interest';
    end if;
    insert into public.curated_guide_activity_kinds (guide_id, activity_kind_id)
    values (p_guide_id, v_id)
    on conflict do nothing;
  end loop;

  for v_id in
    select (value #>> '{}')::uuid
    from jsonb_array_elements(coalesce(p_payload -> 'persona_ids', '[]'::jsonb))
  loop
    if v_id is null then
      continue;
    end if;
    if not exists (select 1 from public.personas where id = v_id) then
      raise exception 'Unknown persona';
    end if;
    insert into public.curated_guide_personas (guide_id, persona_id)
    values (p_guide_id, v_id)
    on conflict do nothing;
  end loop;
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
  v_scale uuid;
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

  begin
    v_scale := nullif(btrim(coalesce(p_payload ->> 'scale_id', '')), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Unknown adventure level';
  end;
  if v_scale is not null and not exists (select 1 from public.activity_scales where id = v_scale) then
    raise exception 'Unknown adventure level';
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
    title, slug, intro, status, publish_at, expire_at, scale_id,
    duplicated_from_id, created_by, updated_by
  ) values (
    v_source.title,
    private.unique_guide_slug(v_source.title, null),
    v_source.intro,
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

revoke all on function private.save_curated_guide_audience(uuid, jsonb) from public, anon, authenticated;
