-- Author cards get a separate cover (banner) from the profile photo.

alter table public.guide_authors
  add column if not exists cover_url text,
  add column if not exists cover_storage_key text;

create or replace function public.admin_save_guide_author_asset(
  p_author_id uuid,
  p_slot text,
  p_url text,
  p_storage_key text
)
returns public.guide_authors
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_existing public.guide_authors;
  v_after public.guide_authors;
  v_slot text := lower(btrim(coalesce(p_slot, '')));
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_slot not in ('photo', 'cover') then
    raise exception 'Unknown photo slot';
  end if;

  select * into v_existing
  from public.guide_authors
  where id = p_author_id;
  if not found then
    raise exception 'Author not found';
  end if;

  if v_role is distinct from 'admin' then
    if v_existing.user_id is distinct from v_actor then
      raise exception 'You can only edit your own author profile';
    end if;
  end if;

  if v_slot = 'cover' then
    update public.guide_authors
    set
      cover_url = nullif(btrim(coalesce(p_url, '')), ''),
      cover_storage_key = nullif(btrim(coalesce(p_storage_key, '')), ''),
      updated_by = v_actor,
      updated_at = now()
    where id = p_author_id
    returning * into v_after;
  else
    update public.guide_authors
    set
      photo_url = nullif(btrim(coalesce(p_url, '')), ''),
      photo_storage_key = nullif(btrim(coalesce(p_storage_key, '')), ''),
      updated_by = v_actor,
      updated_at = now()
    where id = p_author_id
    returning * into v_after;
  end if;

  return v_after;
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
  v_actor uuid := (select auth.uid());
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_name text;
  v_slug text;
  v_user uuid;
  v_after public.guide_authors;
  v_existing public.guide_authors;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Save payload required';
  end if;

  select * into v_existing
  from public.guide_authors
  where id = p_author_id;
  if not found then
    raise exception 'Author not found';
  end if;

  if v_role is distinct from 'admin' then
    if v_existing.user_id is distinct from v_actor then
      raise exception 'You can only edit your own author profile';
    end if;
  end if;

  v_name := btrim(coalesce(p_payload ->> 'display_name', ''));
  if v_name = '' or v_name = 'Untitled Author' then
    raise exception 'Author name is required';
  end if;

  if v_role = 'admin' then
    begin
      v_user := nullif(btrim(coalesce(p_payload ->> 'user_id', '')), '')::uuid;
    exception when invalid_text_representation then
      v_user := null;
    end;
    if v_user is not null and not exists (select 1 from auth.users where id = v_user) then
      raise exception 'Unknown staff user';
    end if;
    if v_user is not null and exists (
      select 1
      from public.guide_authors
      where user_id = v_user
        and id is distinct from p_author_id
    ) then
      raise exception 'That staff login is already linked to another author.';
    end if;
  else
    v_user := v_existing.user_id;
  end if;

  v_slug := private.unique_author_slug(v_name, p_author_id);

  update public.guide_authors
  set
    display_name = v_name,
    slug = v_slug,
    tagline = nullif(btrim(coalesce(p_payload ->> 'tagline', '')), ''),
    bio = nullif(btrim(coalesce(p_payload ->> 'bio', '')), ''),
    photo_url = nullif(btrim(coalesce(p_payload ->> 'photo_url', '')), ''),
    photo_storage_key = nullif(btrim(coalesce(p_payload ->> 'photo_storage_key', '')), ''),
    cover_url = nullif(btrim(coalesce(p_payload ->> 'cover_url', '')), ''),
    cover_storage_key = nullif(btrim(coalesce(p_payload ->> 'cover_storage_key', '')), ''),
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
exception
  when unique_violation then
    if sqlerrm ilike '%guide_authors_user_id_key%' then
      raise exception 'That staff login is already linked to another author.';
    end if;
    if sqlerrm ilike '%guide_authors_slug_unique%' then
      raise exception 'That author name is already in use. Try a slightly different name.';
    end if;
    raise;
end;
$$;

revoke all on function public.admin_save_guide_author_asset(uuid, text, text, text) from public, anon;
grant execute on function public.admin_save_guide_author_asset(uuid, text, text, text) to authenticated;
grant execute on function public.admin_save_guide_author(uuid, jsonb) to authenticated;
