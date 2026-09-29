-- Terms agreement on a listing, and a snapshot so audit rows can show what changed.

alter table public.directory_listings
  add column if not exists terms_accepted boolean not null default false;

comment on column public.directory_listings.terms_accepted is
  'Staff confirmed the listing agrees to the Terms, Privacy Policy, and Content guidelines.';

create or replace function private.listing_editor_snapshot(p_listing_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select jsonb_build_object(
    'name', l.name,
    'branch_name', l.branch_name,
    'short_description', l.short_description,
    'description', l.description,
    'phone', l.phone,
    'email', l.email,
    'website_url', l.website_url,
    'booking_url', l.booking_url,
    'street_address_1', l.street_address_1,
    'street_address_2', l.street_address_2,
    'suburb', l.suburb,
    'city', l.city,
    'province', l.province,
    'postal_code', l.postal_code,
    'maps_url', l.maps_url,
    'booking_required', l.booking_required,
    'indoor_outdoor', l.indoor_outdoor,
    'interest_keywords', l.interest_keywords,
    'persona_keywords', l.persona_keywords,
    'authorised_to_submit', l.authorised_to_submit,
    'image_rights_granted', l.image_rights_granted,
    'terms_accepted', l.terms_accepted,
    'status', l.status,
    'photo_count', (
      select count(*)
      from public.listing_media m
      where m.listing_id = l.id
    ),
    'hours', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', h.day_of_week,
          'opens', to_char(h.opens_at, 'HH24:MI'),
          'closes', to_char(h.closes_at, 'HH24:MI'),
          'closed', h.is_closed,
          'vacation_opens', to_char(h.vacation_opens_at, 'HH24:MI'),
          'vacation_closes', to_char(h.vacation_closes_at, 'HH24:MI'),
          'vacation_closed', h.vacation_is_closed
        )
        order by h.day_of_week
      )
      from public.operating_hours h
      where h.listing_id = l.id
    ), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', a.name,
          'prices', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'name', p.name,
                'standard', p.standard_price,
                'member', p.member_price
              )
              order by p.sort_order, p.name
            )
            from public.price_options p
            where p.listing_activity_id = a.id
              and p.is_active is true
          ), '[]'::jsonb)
        )
        order by a.sort_order, a.name
      )
      from public.listing_activities a
      where a.listing_id = l.id
        and a.status is distinct from 'archived'::public.directory_status
    ), '[]'::jsonb),
    'personas', coalesce((
      select jsonb_agg(pe.title order by pe.sort_order)
      from public.listing_personas lp
      join public.personas pe on pe.id = lp.persona_id
      where lp.listing_id = l.id
    ), '[]'::jsonb),
    'interests', coalesce((
      select jsonb_agg(i.title order by i.title)
      from public.listing_interests li
      join public.interests i on i.id = li.interest_id
      where li.listing_id = l.id
    ), '[]'::jsonb),
    'kinds', coalesce((
      select jsonb_agg(k.title order by k.sort_order)
      from public.listing_activity_kinds lk
      join public.activity_kinds k on k.id = lk.activity_kind_id
      where lk.listing_id = l.id
    ), '[]'::jsonb),
    'scale', (
      select s.title
      from public.listing_activity_scales ls
      join public.activity_scales s on s.id = ls.activity_scale_id
      where ls.listing_id = l.id
      order by ls.is_primary desc
      limit 1
    ),
    'social', coalesce((
      select jsonb_agg(
        sl.platform::text || ': ' || coalesce(sl.url, sl.handle, '')
        order by sl.platform
      )
      from public.social_links sl
      where sl.listing_id = l.id
    ), '[]'::jsonb)
  )
  from public.directory_listings l
  where l.id = p_listing_id;
$fn$;

-- Approval publishes immediately. A future go-live time is not kept.
do $patch$
declare
  def text := pg_get_functiondef('private.apply_listing_action(uuid, text, boolean, text, timestamptz)'::regprocedure);
begin
  if position('v_publish_at := p_publish_at;' in def) > 0 then
    def := replace(def, 'v_publish_at := p_publish_at;', 'v_publish_at := null;');
    def := replace(
      def,
      E'when p_action = ''approve'' and (p_publish_at is null or p_publish_at <= now())\n        then coalesce(published_at, now())',
      E'when p_action = ''approve'' then coalesce(published_at, now())'
    );
    execute def;
  end if;
end
$patch$;

-- Save draft stores a before/after snapshot and the terms agreement.
do $save$
declare
  def text := pg_get_functiondef('private.save_listing_draft(uuid, jsonb)'::regprocedure);
  audit_old text := $old$    jsonb_build_object(
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
    )$old$;
begin
  if position('listing_editor_snapshot' in def) = 0 then
    def := replace(
      def,
      E'  v_deleted uuid;\nbegin',
      E'  v_deleted uuid;\n  v_audit_before jsonb;\n  v_audit_after jsonb;\nbegin'
    );
    def := replace(
      def,
      E'    raise exception ''Listing not found'';\n  end if;\n',
      E'    raise exception ''Listing not found'';\n  end if;\n\n  v_audit_before := private.listing_editor_snapshot(p_listing_id);\n'
    );
    def := replace(
      def,
      E'image_rights_granted = coalesce((p_payload ->> ''image_rights_granted'')::boolean, image_rights_granted),',
      E'image_rights_granted = coalesce((p_payload ->> ''image_rights_granted'')::boolean, image_rights_granted),\n    terms_accepted = coalesce((p_payload ->> ''terms_accepted'')::boolean, terms_accepted),'
    );
    def := replace(
      def,
      E'  where id = p_listing_id;\n\n  insert into public.listing_audit_events (',
      E'  where id = p_listing_id;\n\n  v_audit_after := private.listing_editor_snapshot(p_listing_id);\n\n  insert into public.listing_audit_events ('
    );
    if position(audit_old in def) = 0 then
      raise exception 'save_listing_draft audit block was not found';
    end if;
    def := replace(def, audit_old, '    v_audit_before,' || E'\n    v_audit_after');
    execute def;
  end if;
end
$save$;
