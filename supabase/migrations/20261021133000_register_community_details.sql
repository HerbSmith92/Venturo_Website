drop function if exists public.register_community(text, text, text, text, text, text, text);

create or replace function public.register_community(
  p_title text,
  p_about text,
  p_phone text,
  p_contact_email text,
  p_founder_name text,
  p_founder_email text,
  p_place_label text,
  p_website_url text,
  p_instagram_url text,
  p_facebook_url text,
  p_tiktok_url text,
  p_areas text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_about text := nullif(btrim(coalesce(p_about, '')), '');
  v_place text := nullif(btrim(coalesce(p_place_label, '')), '');
  v_areas text[];
  v_base text;
  v_slug text;
  v_n int := 0;
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_title is null then
    raise exception 'A name is required';
  end if;
  if char_length(v_title) > 120 then
    raise exception 'Keep the name under 120 characters';
  end if;
  if v_about is null then
    raise exception 'Describe the community';
  end if;
  if char_length(v_about) > 4000 then
    raise exception 'Keep the description under 4000 characters';
  end if;
  if nullif(btrim(coalesce(p_founder_name, '')), '') is null then
    raise exception 'Add the founder''s name';
  end if;
  if nullif(btrim(coalesce(p_phone, '')), '') is null
     and nullif(btrim(coalesce(p_contact_email, '')), '') is null then
    raise exception 'Add a contact email or a contact number';
  end if;

  select coalesce(array_agg(area), '{}'::text[])
    into v_areas
  from (
    select btrim(area) as area
    from unnest(coalesce(p_areas, '{}'::text[])) as area
    where btrim(area) <> ''
  ) cleaned;

  if cardinality(v_areas) = 0 and v_place is not null then
    v_areas := array[v_place];
  end if;
  if v_place is null then
    v_place := nullif(array_to_string(v_areas, ' · '), '');
  end if;

  v_base := lower(regexp_replace(v_title, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  if v_base = '' then
    v_base := 'community';
  end if;
  v_base := left(v_base, 72);
  v_slug := v_base;
  while exists (select 1 from public.communities where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
    if v_n > 50 then
      v_slug := v_base || '-' || substr(gen_random_uuid()::text, 1, 8);
      exit;
    end if;
  end loop;

  insert into public.communities (
    title,
    slug,
    about,
    status,
    contact_email,
    phone,
    website_url,
    instagram_url,
    facebook_url,
    tiktok_url,
    founder_name,
    founder_email,
    place_label,
    areas,
    claimed_by,
    claimed_at,
    created_by,
    updated_by
  ) values (
    v_title,
    v_slug,
    v_about,
    'requested',
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_website_url, '')), ''),
    nullif(btrim(coalesce(p_instagram_url, '')), ''),
    nullif(btrim(coalesce(p_facebook_url, '')), ''),
    nullif(btrim(coalesce(p_tiktok_url, '')), ''),
    nullif(btrim(coalesce(p_founder_name, '')), ''),
    nullif(btrim(coalesce(p_founder_email, '')), ''),
    v_place,
    v_areas,
    v_actor,
    now(),
    v_actor,
    v_actor
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_community(text, text, text, text, text, text, text, text, text, text, text, text[]) from public, anon;
grant execute on function public.register_community(text, text, text, text, text, text, text, text, text, text, text, text[]) to authenticated;
