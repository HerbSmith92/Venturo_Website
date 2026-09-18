-- Discover listing coverage: Public Holiday hours + map pin on save.

alter table public.operating_hours
  drop constraint if exists operating_hours_day_range;

alter table public.operating_hours
  add constraint operating_hours_day_range
  check (day_of_week >= 1 and day_of_week <= 8);

comment on constraint operating_hours_day_range on public.operating_hours is
  '1–7 = Monday–Sunday. 8 = Public Holiday, as shown on Discover.';

create or replace function public.admin_save_listing_draft(
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
  v_listing jsonb := coalesce(p_payload -> 'listing', '{}'::jsonb);
  v_lat numeric;
  v_lng numeric;
  v_maps text;
begin
  if v_role not in ('admin', 'editor') then
    raise exception 'Listing edits are for staff';
  end if;

  begin
    v_lat := nullif(btrim(coalesce(v_listing ->> 'latitude', '')), '')::numeric;
  exception when others then
    raise exception 'Latitude must be a number';
  end;

  begin
    v_lng := nullif(btrim(coalesce(v_listing ->> 'longitude', '')), '')::numeric;
  exception when others then
    raise exception 'Longitude must be a number';
  end;

  v_maps := nullif(btrim(coalesce(v_listing ->> 'maps_url', '')), '');
  if v_maps is null and v_lat is not null and v_lng is not null then
    v_maps := 'https://maps.google.com/?q=' || v_lat::text || ',' || v_lng::text;
  end if;

  update public.directory_listings
  set
    latitude = v_lat,
    longitude = v_lng,
    maps_url = v_maps,
    updated_at = now()
  where id = p_listing_id;

  return private.save_listing_draft(p_listing_id, p_payload);
end;
$$;
