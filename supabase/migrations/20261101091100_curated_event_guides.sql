-- Event Guides: staff-authored lists of upcoming live events.
-- Separate from listing Guides. Roles stay in auth.users raw_app_meta_data.

create table if not exists public.curated_event_guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  intro text,
  status public.curated_guide_status not null default 'draft',
  publish_at timestamptz,
  expire_at timestamptz,
  max_price_cents int,
  place_id uuid references public.places (id) on delete set null,
  interest_labels text[] not null default '{}',
  persona_labels text[] not null default '{}',
  energy_ranks int[] not null default '{}',
  duplicated_from_id uuid references public.curated_event_guides (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curated_event_guides_slug_unique unique (slug),
  constraint curated_event_guides_dates_ok check (
    expire_at is null or publish_at is null or expire_at > publish_at
  ),
  constraint curated_event_guides_price_ok check (
    max_price_cents is null or max_price_cents > 0
  ),
  constraint curated_event_guides_energy_ok check (
    energy_ranks <@ array[1, 2, 3, 4, 5]::int[]
  )
);

create index if not exists curated_event_guides_live_idx
  on public.curated_event_guides (status, publish_at desc, updated_at desc);

create table if not exists public.curated_event_guide_items (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.curated_event_guides (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  sort_order int not null default 0,
  editorial_note text,
  created_at timestamptz not null default now(),
  constraint curated_event_guide_items_unique unique (guide_id, event_id)
);

create index if not exists curated_event_guide_items_guide_idx
  on public.curated_event_guide_items (guide_id, sort_order);

alter table public.curated_event_guides enable row level security;
alter table public.curated_event_guide_items enable row level security;

drop policy if exists curated_event_guides_read on public.curated_event_guides;
create policy curated_event_guides_read
  on public.curated_event_guides
  for select
  to anon, authenticated
  using (
    public.curated_guide_is_live(status, publish_at, expire_at)
    or public.is_staff()
  );

drop policy if exists curated_event_guides_staff_write on public.curated_event_guides;
create policy curated_event_guides_staff_write
  on public.curated_event_guides
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists curated_event_guide_items_read on public.curated_event_guide_items;
create policy curated_event_guide_items_read
  on public.curated_event_guide_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.curated_event_guides g
      where g.id = guide_id
        and (
          public.curated_guide_is_live(g.status, g.publish_at, g.expire_at)
          or public.is_staff()
        )
    )
  );

drop policy if exists curated_event_guide_items_staff_write on public.curated_event_guide_items;
create policy curated_event_guide_items_staff_write
  on public.curated_event_guide_items
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select on public.curated_event_guides to anon, authenticated;
grant select on public.curated_event_guide_items to anon, authenticated;
grant insert, update, delete on public.curated_event_guides to authenticated;
grant insert, update, delete on public.curated_event_guide_items to authenticated;

create or replace function private.unique_event_guide_slug(p_title text, p_exclude uuid default null)
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
    v_base := 'event-guide';
  end if;
  v_slug := v_base;
  while exists (
    select 1
    from public.curated_event_guides
    where slug = v_slug
      and (p_exclude is null or id is distinct from p_exclude)
  ) loop
    v_slug := v_base || '-' || v_n::text;
    v_n := v_n + 1;
  end loop;
  return v_slug;
end;
$$;

create or replace function private.save_curated_event_guide_contents(
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
  v_event uuid;
  v_order int := 0;
  v_seen uuid[] := '{}';
begin
  delete from public.curated_event_guide_items where guide_id = p_guide_id;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb))
  loop
    begin
      v_event := (v_item ->> 'event_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Each recommendation needs an event';
    end;
    if v_event is null then
      raise exception 'Each recommendation needs an event';
    end if;
    if v_event = any (v_seen) then
      continue;
    end if;
    if not exists (select 1 from public.events where id = v_event) then
      raise exception 'Event not found';
    end if;
    insert into public.curated_event_guide_items (
      guide_id, event_id, sort_order, editorial_note
    ) values (
      p_guide_id,
      v_event,
      coalesce((v_item ->> 'sort_order')::int, v_order),
      nullif(btrim(coalesce(v_item ->> 'editorial_note', '')), '')
    );
    v_seen := array_append(v_seen, v_event);
    v_order := v_order + 1;
  end loop;
end;
$$;

create or replace function private.create_curated_event_guide()
returns public.curated_event_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_row public.curated_event_guides;
begin
  insert into public.curated_event_guides (
    title, slug, status, created_by, updated_by
  ) values (
    'Untitled Event Guide',
    private.unique_event_guide_slug('Untitled Event Guide', null),
    'draft',
    v_actor,
    v_actor
  )
  returning * into v_row;
  return v_row;
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
  v_actor uuid := private.require_guide_admin();
  v_title text;
  v_slug text;
  v_intro text;
  v_publish timestamptz;
  v_expire timestamptz;
  v_price int;
  v_place uuid;
  v_interests text[];
  v_personas text[];
  v_ranks int[];
  v_after public.curated_event_guides;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Save payload required';
  end if;

  if not exists (select 1 from public.curated_event_guides where id = p_guide_id) then
    raise exception 'Event guide not found';
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

  v_slug := public.slugify(coalesce(p_payload ->> 'slug', v_title));
  if v_slug is null or v_slug = '' then
    v_slug := private.unique_event_guide_slug(v_title, p_guide_id);
  else
    if exists (
      select 1 from public.curated_event_guides
      where slug = v_slug and id is distinct from p_guide_id
    ) then
      v_slug := private.unique_event_guide_slug(v_slug, p_guide_id);
    end if;
  end if;

  update public.curated_event_guides
  set
    title = v_title,
    slug = v_slug,
    intro = v_intro,
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

create or replace function private.duplicate_curated_event_guide(p_guide_id uuid)
returns public.curated_event_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_source public.curated_event_guides;
  v_row public.curated_event_guides;
begin
  select * into v_source
  from public.curated_event_guides
  where id = p_guide_id;

  if not found then
    raise exception 'Event guide not found';
  end if;

  insert into public.curated_event_guides (
    title, slug, intro, status, publish_at, expire_at,
    max_price_cents, place_id, interest_labels, persona_labels, energy_ranks,
    duplicated_from_id, created_by, updated_by
  ) values (
    v_source.title,
    private.unique_event_guide_slug(v_source.title, null),
    v_source.intro,
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

create or replace function public.admin_create_curated_event_guide()
returns public.curated_event_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_curated_event_guide();
end;
$$;

create or replace function public.admin_save_curated_event_guide(
  p_guide_id uuid,
  p_payload jsonb
)
returns public.curated_event_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.save_curated_event_guide(p_guide_id, p_payload);
end;
$$;

create or replace function public.admin_apply_event_guide_action(
  p_guide_id uuid,
  p_action text
)
returns public.curated_event_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.apply_event_guide_action(p_guide_id, p_action);
end;
$$;

create or replace function public.admin_duplicate_curated_event_guide(p_guide_id uuid)
returns public.curated_event_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.duplicate_curated_event_guide(p_guide_id);
end;
$$;

revoke all on function public.admin_create_curated_event_guide() from public, anon;
grant execute on function public.admin_create_curated_event_guide() to authenticated;

revoke all on function public.admin_save_curated_event_guide(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_curated_event_guide(uuid, jsonb) to authenticated;

revoke all on function public.admin_apply_event_guide_action(uuid, text) from public, anon;
grant execute on function public.admin_apply_event_guide_action(uuid, text) to authenticated;

revoke all on function public.admin_duplicate_curated_event_guide(uuid) from public, anon;
grant execute on function public.admin_duplicate_curated_event_guide(uuid) to authenticated;
