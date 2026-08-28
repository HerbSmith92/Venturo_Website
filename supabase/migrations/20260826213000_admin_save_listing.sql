-- Control Room listing editor: permission flags + privileged save.
-- Publish still goes through private.apply_listing_action.

alter table public.directory_listings
  add column if not exists authorised_to_submit boolean not null default false,
  add column if not exists image_rights_granted boolean not null default false;

comment on column public.directory_listings.authorised_to_submit is
  'Submitter confirmed they are authorised to list this business.';
comment on column public.directory_listings.image_rights_granted is
  'Submitter confirmed image & copy rights for app, website, social, and ads.';

create or replace function private.save_listing_draft(
  p_listing_id uuid,
  p_payload jsonb
)
returns public.directory_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_actor uuid := (select auth.uid());
  v_before public.directory_listings;
  v_after public.directory_listings;
  v_listing jsonb := coalesce(p_payload -> 'listing', '{}'::jsonb);
  v_business jsonb := coalesce(p_payload -> 'business', '{}'::jsonb);
  v_hour jsonb;
  v_price jsonb;
  v_social jsonb;
  v_id uuid;
  v_opens time;
  v_closes time;
  v_closed boolean;
  v_kind uuid;
  v_first boolean;
  v_indoor text;
  v_platform text;
  v_url text;
  v_handle text;
  v_cover uuid;
  v_price_from numeric;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_role not in ('admin', 'editor') then
    raise exception 'Listing edits are for staff';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Save payload required';
  end if;

  select * into v_before
  from public.directory_listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  if coalesce(btrim(v_listing ->> 'name'), '') = '' then
    raise exception 'Listing name is required';
  end if;

  v_indoor := nullif(btrim(coalesce(v_listing ->> 'indoor_outdoor', '')), '');
  if v_indoor is not null and v_indoor not in ('indoor', 'outdoor', 'both') then
    raise exception 'Indoor / outdoor must be indoor, outdoor, or both';
  end if;

  update public.directory_listings
  set
    name = btrim(v_listing ->> 'name'),
    branch_name = nullif(btrim(coalesce(v_listing ->> 'branch_name', '')), ''),
    short_description = nullif(btrim(coalesce(v_listing ->> 'short_description', '')), ''),
    description = nullif(btrim(coalesce(v_listing ->> 'description', '')), ''),
    phone = nullif(btrim(coalesce(v_listing ->> 'phone', '')), ''),
    email = nullif(btrim(coalesce(v_listing ->> 'email', '')), ''),
    website_url = nullif(btrim(coalesce(v_listing ->> 'website_url', '')), ''),
    booking_url = nullif(btrim(coalesce(v_listing ->> 'booking_url', '')), ''),
    street_address_1 = nullif(btrim(coalesce(v_listing ->> 'street_address_1', '')), ''),
    street_address_2 = nullif(btrim(coalesce(v_listing ->> 'street_address_2', '')), ''),
    suburb = nullif(btrim(coalesce(v_listing ->> 'suburb', '')), ''),
    city = nullif(btrim(coalesce(v_listing ->> 'city', '')), ''),
    province = nullif(btrim(coalesce(v_listing ->> 'province', '')), ''),
    postal_code = nullif(btrim(coalesce(v_listing ->> 'postal_code', '')), ''),
    booking_required = coalesce((v_listing ->> 'booking_required')::boolean, booking_required),
    indoor_outdoor = case
      when v_indoor is null then null
      else v_indoor::public.indoor_outdoor
    end,
    authorised_to_submit = coalesce((p_payload ->> 'authorised_to_submit')::boolean, authorised_to_submit),
    image_rights_granted = coalesce((p_payload ->> 'image_rights_granted')::boolean, image_rights_granted),
    updated_at = now()
  where id = p_listing_id;

  if v_business <> '{}'::jsonb then
    update public.businesses
    set
      name = coalesce(nullif(btrim(coalesce(v_business ->> 'name', '')), ''), name),
      description = coalesce(nullif(btrim(coalesce(v_business ->> 'description', '')), ''), description),
      website_url = coalesce(
        nullif(btrim(coalesce(v_business ->> 'website_url', '')), ''),
        website_url
      ),
      updated_at = now()
    where id = v_before.business_id;
  end if;

  if jsonb_typeof(p_payload -> 'hours') = 'array' then
    delete from public.operating_hours where listing_id = p_listing_id;

    for v_hour in
      select value from jsonb_array_elements(p_payload -> 'hours')
    loop
      v_closed := coalesce((v_hour ->> 'is_closed')::boolean, false);
      v_opens := nullif(btrim(coalesce(v_hour ->> 'opens_at', '')), '')::time;
      v_closes := nullif(btrim(coalesce(v_hour ->> 'closes_at', '')), '')::time;
      insert into public.operating_hours (
        listing_id, day_of_week, opens_at, closes_at, is_closed
      ) values (
        p_listing_id,
        (v_hour ->> 'day_of_week')::smallint,
        case when v_closed then null else v_opens end,
        case when v_closed then null else v_closes end,
        v_closed
      );
    end loop;
  end if;

  if jsonb_typeof(p_payload -> 'prices') = 'array' then
    for v_price in
      select value from jsonb_array_elements(p_payload -> 'prices')
    loop
      if coalesce(btrim(v_price ->> 'name'), '') = '' then
        continue;
      end if;
      v_id := nullif(btrim(coalesce(v_price ->> 'id', '')), '')::uuid;
      if v_id is not null then
        update public.price_options
        set
          name = btrim(v_price ->> 'name'),
          standard_price = coalesce((v_price ->> 'standard_price')::numeric, standard_price),
          member_price = nullif(btrim(coalesce(v_price ->> 'member_price', '')), '')::numeric,
          inclusions = nullif(btrim(coalesce(v_price ->> 'inclusions', '')), ''),
          is_active = coalesce((v_price ->> 'is_active')::boolean, true),
          updated_at = now()
        where id = v_id
          and listing_id = p_listing_id;
      else
        insert into public.price_options (
          listing_id, name, standard_price, member_price, inclusions, is_active
        ) values (
          p_listing_id,
          btrim(v_price ->> 'name'),
          coalesce(nullif(btrim(coalesce(v_price ->> 'standard_price', '')), '')::numeric, 0),
          nullif(btrim(coalesce(v_price ->> 'member_price', '')), '')::numeric,
          nullif(btrim(coalesce(v_price ->> 'inclusions', '')), ''),
          coalesce((v_price ->> 'is_active')::boolean, true)
        );
      end if;
    end loop;
  end if;

  select min(standard_price) into v_price_from
  from public.price_options
  where listing_id = p_listing_id
    and is_active is true;

  update public.directory_listings
  set price_from = v_price_from
  where id = p_listing_id;

  if jsonb_typeof(p_payload -> 'persona_ids') = 'array' then
    delete from public.listing_personas where listing_id = p_listing_id;
    v_first := true;
    for v_kind in
      select nullif(btrim(elem), '')::uuid
      from jsonb_array_elements_text(p_payload -> 'persona_ids') as elem
    loop
      if v_kind is null then
        continue;
      end if;
      insert into public.listing_personas (listing_id, persona_id, is_primary, source, reviewed)
      values (p_listing_id, v_kind, v_first, 'manual', true);
      v_first := false;
    end loop;
  end if;

  if jsonb_typeof(p_payload -> 'interest_ids') = 'array' then
    delete from public.listing_interests where listing_id = p_listing_id;
    v_first := true;
    for v_kind in
      select nullif(btrim(elem), '')::uuid
      from jsonb_array_elements_text(p_payload -> 'interest_ids') as elem
    loop
      if v_kind is null then
        continue;
      end if;
      insert into public.listing_interests (listing_id, interest_id, is_primary, source, reviewed)
      values (p_listing_id, v_kind, v_first, 'manual', true);
      v_first := false;
    end loop;
  end if;

  if jsonb_typeof(p_payload -> 'scale_ids') = 'array' then
    delete from public.listing_activity_scales where listing_id = p_listing_id;
    v_first := true;
    for v_kind in
      select nullif(btrim(elem), '')::uuid
      from jsonb_array_elements_text(p_payload -> 'scale_ids') as elem
    loop
      if v_kind is null then
        continue;
      end if;
      insert into public.listing_activity_scales (
        listing_id, activity_scale_id, is_primary, source, reviewed
      ) values (p_listing_id, v_kind, v_first, 'manual', true);
      v_first := false;
    end loop;
  end if;

  if jsonb_typeof(p_payload -> 'kind_ids') = 'array' then
    delete from public.listing_activity_kinds where listing_id = p_listing_id;
    v_first := true;
    for v_kind in
      select nullif(btrim(elem), '')::uuid
      from jsonb_array_elements_text(p_payload -> 'kind_ids') as elem
    loop
      if v_kind is null then
        continue;
      end if;
      insert into public.listing_activity_kinds (
        listing_id, activity_kind_id, is_primary, source, reviewed
      ) values (p_listing_id, v_kind, v_first, 'manual', true);
      v_first := false;
    end loop;
  end if;

  if jsonb_typeof(p_payload -> 'social') = 'array' then
    delete from public.social_links where listing_id = p_listing_id;
    for v_social in
      select value from jsonb_array_elements(p_payload -> 'social')
    loop
      v_platform := lower(btrim(coalesce(v_social ->> 'platform', '')));
      v_url := nullif(btrim(coalesce(v_social ->> 'url', '')), '');
      v_handle := nullif(btrim(coalesce(v_social ->> 'handle', '')), '');
      if v_platform not in ('instagram', 'facebook', 'tiktok', 'x', 'youtube', 'linkedin') then
        continue;
      end if;
      if v_url is null and v_handle is null then
        continue;
      end if;
      if v_url is null then
        v_url := case v_platform
          when 'instagram' then 'https://instagram.com/' || ltrim(v_handle, '@')
          when 'facebook' then 'https://facebook.com/' || ltrim(v_handle, '@')
          when 'tiktok' then 'https://tiktok.com/@' || ltrim(v_handle, '@')
          else 'https://' || v_platform || '.com/' || ltrim(v_handle, '@')
        end;
      end if;
      insert into public.social_links (listing_id, platform, handle, url, is_primary)
      values (p_listing_id, v_platform::public.social_platform, v_handle, v_url, false);
    end loop;
  end if;

  v_cover := nullif(btrim(coalesce(p_payload ->> 'cover_media_id', '')), '')::uuid;
  if v_cover is not null then
    update public.listing_media
    set is_cover = (id = v_cover)
    where listing_id = p_listing_id;
  end if;

  select * into v_after
  from public.directory_listings
  where id = p_listing_id;

  insert into public.listing_audit_events (
    listing_id, actor_id, action, from_status, to_status, before, after
  ) values (
    p_listing_id,
    v_actor,
    'edit',
    v_before.status,
    v_after.status,
    jsonb_build_object(
      'name', v_before.name,
      'short_description', v_before.short_description,
      'authorised_to_submit', v_before.authorised_to_submit,
      'image_rights_granted', v_before.image_rights_granted
    ),
    jsonb_build_object(
      'name', v_after.name,
      'short_description', v_after.short_description,
      'authorised_to_submit', v_after.authorised_to_submit,
      'image_rights_granted', v_after.image_rights_granted
    )
  );

  return v_after;
end;
$$;

create or replace function public.admin_save_listing_draft(
  p_listing_id uuid,
  p_payload jsonb
)
returns public.directory_listings
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.save_listing_draft(p_listing_id, p_payload);
end;
$$;

revoke all on function public.admin_save_listing_draft(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_listing_draft(uuid, jsonb) to authenticated;
