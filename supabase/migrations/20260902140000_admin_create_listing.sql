-- Control Room: create a blank directory draft (business + listing).
-- Slug stays unique; unpublished listings pick up a name-based slug on save.

create or replace function private.unique_listing_slug(p_title text, p_exclude uuid default null)
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
    v_base := 'listing';
  end if;
  v_slug := v_base;
  while exists (
    select 1
    from public.directory_listings
    where slug = v_slug
      and (p_exclude is null or id is distinct from p_exclude)
  ) loop
    v_slug := v_base || '-' || v_n::text;
    v_n := v_n + 1;
  end loop;
  return v_slug;
end;
$$;

create or replace function private.unique_business_slug(p_title text, p_exclude uuid default null)
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
    v_base := 'business';
  end if;
  v_slug := v_base;
  while exists (
    select 1
    from public.businesses
    where slug = v_slug
      and (p_exclude is null or id is distinct from p_exclude)
  ) loop
    v_slug := v_base || '-' || v_n::text;
    v_n := v_n + 1;
  end loop;
  return v_slug;
end;
$$;

create or replace function private.sync_unpublished_listing_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.published_at is not null then
    return NEW;
  end if;
  if NEW.slug is null
    or btrim(NEW.slug) = ''
    or TG_OP = 'INSERT'
    or NEW.name is distinct from OLD.name
  then
    NEW.slug := private.unique_listing_slug(NEW.name, NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists sync_unpublished_listing_slug on public.directory_listings;
create trigger sync_unpublished_listing_slug
before insert or update of name, slug, published_at
on public.directory_listings
for each row
execute function private.sync_unpublished_listing_slug();

create or replace function private.sync_draft_business_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.status is distinct from 'draft' then
    return NEW;
  end if;
  if NEW.slug is null
    or btrim(NEW.slug) = ''
    or TG_OP = 'INSERT'
    or NEW.name is distinct from OLD.name
  then
    NEW.slug := private.unique_business_slug(NEW.name, NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists sync_draft_business_slug on public.businesses;
create trigger sync_draft_business_slug
before insert or update of name, slug, status
on public.businesses
for each row
execute function private.sync_draft_business_slug();

create or replace function private.create_directory_listing()
returns public.directory_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_actor uuid := (select auth.uid());
  v_business_id uuid;
  v_row public.directory_listings;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_role not in ('admin', 'editor') then
    raise exception 'Listing edits are for staff';
  end if;

  insert into public.businesses (name, slug, status)
  values (
    'Untitled Business',
    private.unique_business_slug('Untitled Business', null),
    'draft'
  )
  returning id into v_business_id;

  insert into public.directory_listings (business_id, name, slug, status)
  values (
    v_business_id,
    'Untitled Listing',
    private.unique_listing_slug('Untitled Listing', null),
    'draft'
  )
  returning * into v_row;

  insert into public.listing_audit_events (
    listing_id, actor_id, action, from_status, to_status, before, after
  ) values (
    v_row.id,
    v_actor,
    'create',
    null,
    v_row.status,
    '{}'::jsonb,
    jsonb_build_object('name', v_row.name, 'slug', v_row.slug)
  );

  return v_row;
end;
$$;

create or replace function public.admin_create_listing()
returns public.directory_listings
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_directory_listing();
end;
$$;

revoke all on function public.admin_create_listing() from public, anon;
grant execute on function public.admin_create_listing() to authenticated;
