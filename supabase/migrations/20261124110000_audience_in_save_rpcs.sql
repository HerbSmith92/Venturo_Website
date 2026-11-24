-- Persist content audience on listing save RPC, and audience + setting on live host event updates.

do $patch_listing$
declare
  def text := pg_get_functiondef('private.save_listing_draft(uuid, jsonb)'::regprocedure);
  needle text;
  replacement text;
begin
  if position('v_audience text' in def) > 0 then
    return;
  end if;

  needle := $n$  v_indoor text;
  v_platform text;$n$;
  replacement := $n$  v_indoor text;
  v_audience text;
  v_platform text;$n$;
  if position(needle in def) = 0 then
    raise exception 'save_listing_draft declare point for v_indoor was not found';
  end if;
  def := replace(def, needle, replacement);

  needle := $n$  v_indoor := nullif(btrim(coalesce(v_listing ->> 'indoor_outdoor', '')), '');
  if v_indoor is not null and v_indoor not in ('indoor', 'outdoor', 'both') then
    raise exception 'Indoor / outdoor must be indoor, outdoor, or both';
  end if;

  update public.directory_listings$n$;
  replacement := $n$  v_indoor := nullif(btrim(coalesce(v_listing ->> 'indoor_outdoor', '')), '');
  if v_indoor is not null and v_indoor not in ('indoor', 'outdoor', 'both') then
    raise exception 'Indoor / outdoor must be indoor, outdoor, or both';
  end if;

  v_audience := lower(nullif(btrim(coalesce(v_listing ->> 'audience', '')), ''));
  if v_audience is null then
    v_audience := 'all';
  elsif v_audience not in ('all', 'women', 'men') then
    raise exception 'Audience must be all, women, or men';
  end if;

  update public.directory_listings$n$;
  if position(needle in def) = 0 then
    raise exception 'save_listing_draft indoor validation point was not found';
  end if;
  def := replace(def, needle, replacement);

  needle := $n$    indoor_outdoor = case
      when v_indoor is null then null
      else v_indoor::public.indoor_outdoor
    end,
    interest_keywords = case$n$;
  replacement := $n$    indoor_outdoor = case
      when v_indoor is null then null
      else v_indoor::public.indoor_outdoor
    end,
    audience = v_audience,
    interest_keywords = case$n$;
  if position(needle in def) = 0 then
    raise exception 'save_listing_draft indoor_outdoor update point was not found';
  end if;
  def := replace(def, needle, replacement);

  execute def;
end
$patch_listing$;

create or replace function public.host_update_live_event(p_event_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  ticket jsonb;
  ticket_id uuid;
  sold int;
  next_audience text;
  next_setting text;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not public.can_manage_event(p_event_id) then raise exception 'not allowed'; end if;

  next_audience := lower(nullif(btrim(coalesce(p_payload->>'audience', '')), ''));
  if next_audience is not null and next_audience not in ('all', 'women', 'men') then
    raise exception 'Audience must be all, women, or men';
  end if;

  next_setting := lower(nullif(btrim(coalesce(p_payload->>'indoor_outdoor', '')), ''));
  if next_setting is not null and next_setting not in ('indoor', 'outdoor', 'both') then
    raise exception 'Indoor / outdoor must be indoor, outdoor, or both';
  end if;

  update public.events
  set
    title = coalesce(p_payload->>'title', title),
    description = coalesce(p_payload->>'description', description),
    age_restriction = p_payload->>'age_restriction',
    audience_gender = coalesce(p_payload->>'audience_gender', audience_gender),
    audience = coalesce(next_audience, audience),
    indoor_outdoor = case
      when p_payload ? 'indoor_outdoor' and next_setting is null then null
      when next_setting is not null then next_setting::public.indoor_outdoor
      else indoor_outdoor
    end,
    format = p_payload->>'format',
    category = p_payload->>'category',
    tags = coalesce(array(select jsonb_array_elements_text(p_payload->'tags')), tags),
    banner_url = p_payload->>'banner_url',
    listing_image_url = p_payload->>'listing_image_url',
    story_image_url = p_payload->>'story_image_url',
    starts_at = coalesce((p_payload->>'starts_at')::timestamptz, starts_at),
    ends_at = coalesce((p_payload->>'ends_at')::timestamptz, ends_at),
    timezone = coalesce(p_payload->>'timezone', timezone),
    venue_name = coalesce(p_payload->>'venue_name', venue_name),
    address_line1 = p_payload->>'address_line1',
    address_line2 = p_payload->>'address_line2',
    city = p_payload->>'city',
    postal_code = p_payload->>'postal_code',
    country = coalesce(p_payload->>'country', country),
    latitude = nullif(p_payload->>'latitude', '')::double precision,
    longitude = nullif(p_payload->>'longitude', '')::double precision,
    show_map = coalesce((p_payload->>'show_map')::boolean, show_map),
    visibility = coalesce((p_payload->>'visibility')::public.event_visibility, visibility),
    prohibited_items = p_payload->>'prohibited_items',
    updated_at = now()
  where id = p_event_id;

  if p_payload ? 'ticket_types' and jsonb_typeof(p_payload->'ticket_types') = 'array' then
    for ticket in select * from jsonb_array_elements(p_payload->'ticket_types')
    loop
      ticket_id := nullif(ticket->>'id', '')::uuid;
      if ticket_id is not null then
        select sold_count into sold from public.event_ticket_types
        where id = ticket_id and event_id = p_event_id;
        if not found then continue; end if;
        update public.event_ticket_types
        set
          name = coalesce(nullif(trim(ticket->>'name'), ''), name),
          quantity = greatest(sold, coalesce((ticket->>'quantity')::int, quantity)),
          price_cents = coalesce((ticket->>'priceCents')::int, price_cents),
          member_price_cents = (ticket->>'memberPriceCents')::int,
          member_discount_kind = coalesce(ticket->>'memberDiscountKind', member_discount_kind),
          member_discount_value = (ticket->>'memberDiscountValue')::numeric,
          members_only = coalesce((ticket->>'membersOnly')::boolean, members_only),
          pass_fees_to_buyer = coalesce((ticket->>'passFeesToBuyer')::boolean, pass_fees_to_buyer),
          pass_commission_to_buyer = coalesce((ticket->>'passCommissionToBuyer')::boolean, pass_commission_to_buyer)
        where id = ticket_id;
      else
        insert into public.event_ticket_types (
          event_id, name, kind, price_cents, member_price_cents, member_discount_kind,
          member_discount_value, members_only, pass_fees_to_buyer, pass_commission_to_buyer,
          quantity, sort_order
        ) values (
          p_event_id,
          coalesce(nullif(trim(ticket->>'name'), ''), 'Ticket'),
          coalesce((ticket->>'kind')::public.ticket_kind, 'paid'),
          coalesce((ticket->>'priceCents')::int, 0),
          (ticket->>'memberPriceCents')::int,
          coalesce(ticket->>'memberDiscountKind', 'none'),
          (ticket->>'memberDiscountValue')::numeric,
          coalesce((ticket->>'membersOnly')::boolean, false),
          coalesce((ticket->>'passFeesToBuyer')::boolean, false),
          coalesce((ticket->>'passCommissionToBuyer')::boolean, false),
          greatest(1, coalesce((ticket->>'quantity')::int, 1)),
          coalesce((ticket->>'sortOrder')::int, 0)
        );
      end if;
    end loop;
  end if;
end;
$$;

revoke all on function public.host_update_live_event(uuid, jsonb) from public, anon;
grant execute on function public.host_update_live_event(uuid, jsonb) to authenticated, service_role;
