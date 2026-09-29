-- Live listings keep their published row until an admin approves a revision.
-- Staff edits are stored on listing_revisions. The public directory keeps reading
-- the approved columns. New photos on a live listing stay hidden until approval.

create table if not exists public.listing_revisions (
  listing_id uuid primary key references public.directory_listings (id) on delete cascade,
  payload jsonb not null,
  state text not null,
  updated_at timestamptz not null default now(),
  constraint listing_revisions_state_check check (state in ('draft', 'review'))
);

comment on table public.listing_revisions is
  'Unpublished edits for a live directory listing. Applied only when an admin approves them.';

alter table public.listing_revisions enable row level security;

drop policy if exists "Staff can read listing revisions" on public.listing_revisions;
create policy "Staff can read listing revisions"
on public.listing_revisions
for select
to authenticated
using (
  coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = any (array['admin', 'editor'])
);

alter table public.listing_media
  add column if not exists is_pending boolean not null default false;

comment on column public.listing_media.is_pending is
  'Uploaded against a live listing. Hidden from the public directory until the revision is approved.';

alter policy listing_media_select_approved
on public.listing_media
using (
  is_pending is not true
  and exists (
    select 1
    from public.directory_listings d
    where d.id = listing_media.listing_id
      and d.status = 'approved'::public.directory_status
  )
);

create or replace function private.payload_audit_snapshot(p_payload jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'name', '')), ''),
    'branch_name', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'branch_name', '')), ''),
    'short_description', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'short_description', '')), ''),
    'description', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'description', '')), ''),
    'phone', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'phone', '')), ''),
    'email', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'email', '')), ''),
    'website_url', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'website_url', '')), ''),
    'booking_url', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'booking_url', '')), ''),
    'street_address_1', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'street_address_1', '')), ''),
    'street_address_2', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'street_address_2', '')), ''),
    'suburb', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'suburb', '')), ''),
    'city', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'city', '')), ''),
    'province', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'province', '')), ''),
    'postal_code', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'postal_code', '')), ''),
    'maps_url', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'maps_url', '')), ''),
    'booking_required', coalesce((p_payload -> 'listing' ->> 'booking_required')::boolean, false),
    'indoor_outdoor', nullif(btrim(coalesce(p_payload -> 'listing' ->> 'indoor_outdoor', '')), ''),
    'interest_keywords', nullif(btrim(coalesce(p_payload ->> 'interest_keywords', '')), ''),
    'persona_keywords', nullif(btrim(coalesce(p_payload ->> 'persona_keywords', '')), ''),
    'authorised_to_submit', coalesce((p_payload ->> 'authorised_to_submit')::boolean, false),
    'image_rights_granted', coalesce((p_payload ->> 'image_rights_granted')::boolean, false),
    'terms_accepted', coalesce((p_payload ->> 'terms_accepted')::boolean, false),
    'photo_count', coalesce(jsonb_array_length(
      case
        when jsonb_typeof(p_payload -> 'media') = 'array' then p_payload -> 'media'
        else '[]'::jsonb
      end
    ), 0),
    'hours', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', (h ->> 'day_of_week')::int,
          'opens', case
            when coalesce((h ->> 'is_closed')::boolean, false) then null
            else to_char(nullif(h ->> 'opens_at', '')::time, 'HH24:MI')
          end,
          'closes', case
            when coalesce((h ->> 'is_closed')::boolean, false) then null
            else to_char(nullif(h ->> 'closes_at', '')::time, 'HH24:MI')
          end,
          'closed', coalesce((h ->> 'is_closed')::boolean, false),
          'vacation_opens', case
            when coalesce((h ->> 'vacation_is_closed')::boolean, false) then null
            else to_char(nullif(h ->> 'vacation_opens_at', '')::time, 'HH24:MI')
          end,
          'vacation_closes', case
            when coalesce((h ->> 'vacation_is_closed')::boolean, false) then null
            else to_char(nullif(h ->> 'vacation_closes_at', '')::time, 'HH24:MI')
          end,
          'vacation_closed', coalesce((h ->> 'vacation_is_closed')::boolean, false)
        )
        order by (h ->> 'day_of_week')::int
      )
      from jsonb_array_elements(coalesce(p_payload -> 'hours', '[]'::jsonb)) h
    ), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', nullif(btrim(coalesce(a ->> 'name', '')), ''),
          'prices', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'name', nullif(btrim(coalesce(p ->> 'name', '')), ''),
                'standard', nullif(p ->> 'standard_price', '')::numeric,
                'member', nullif(p ->> 'member_price', '')::numeric
              )
              order by coalesce((p ->> 'sort_order')::int, 0), p ->> 'name'
            )
            from jsonb_array_elements(coalesce(a -> 'prices', '[]'::jsonb)) p
            where coalesce((p ->> 'is_active')::boolean, true)
              and nullif(btrim(coalesce(p ->> 'name', '')), '') is not null
          ), '[]'::jsonb)
        )
        order by coalesce((a ->> 'sort_order')::int, 0), a ->> 'name'
      )
      from jsonb_array_elements(coalesce(p_payload -> 'activities', '[]'::jsonb)) a
      where coalesce((a ->> 'is_active')::boolean, true)
        and nullif(btrim(coalesce(a ->> 'name', '')), '') is not null
    ), '[]'::jsonb),
    'personas', coalesce((
      select jsonb_agg(pe.title order by pe.sort_order)
      from jsonb_array_elements_text(coalesce(p_payload -> 'persona_ids', '[]'::jsonb)) elem
      join public.personas pe on pe.id = elem::uuid
    ), '[]'::jsonb),
    'interests', coalesce((
      select jsonb_agg(i.title order by i.title)
      from jsonb_array_elements_text(coalesce(p_payload -> 'interest_ids', '[]'::jsonb)) elem
      join public.interests i on i.id = elem::uuid
    ), '[]'::jsonb),
    'kinds', coalesce((
      select jsonb_agg(k.title order by k.sort_order)
      from jsonb_array_elements_text(coalesce(p_payload -> 'kind_ids', '[]'::jsonb)) elem
      join public.activity_kinds k on k.id = elem::uuid
    ), '[]'::jsonb),
    'scale', (
      select s.title
      from public.activity_scales s
      where s.id = nullif(p_payload -> 'scale_ids' ->> 0, '')::uuid
    ),
    'social', coalesce((
      select jsonb_agg(
        (s ->> 'platform') || ': ' || coalesce(nullif(s ->> 'url', ''), nullif(s ->> 'handle', ''), '')
        order by s ->> 'platform'
      )
      from jsonb_array_elements(coalesce(p_payload -> 'social', '[]'::jsonb)) s
    ), '[]'::jsonb)
  );
$$;

revoke all on function private.payload_audit_snapshot(jsonb) from public, anon, authenticated;

do $snap$
declare
  def text := pg_get_functiondef('private.listing_editor_snapshot(uuid)'::regprocedure);
  needle text := $n$where m.listing_id = l.id$n$;
  replacement text := $n$where m.listing_id = l.id
        and m.is_pending is not true$n$;
begin
  if position('m.is_pending is not true' in def) = 0 then
    if position(needle in def) = 0 then
      raise exception 'listing_editor_snapshot photo filter was not found';
    end if;
    execute replace(def, needle, replacement);
  end if;
end
$snap$;

do $save$
declare
  def text := pg_get_functiondef('private.save_listing_draft(uuid, jsonb)'::regprocedure);
  needle text;
  replacement text;
begin
  if position('when status in (''approved'', ''review'')' in def) > 0 then
    needle := $n$status = case
      when status in ('approved', 'review') then 'draft'::public.directory_status
      else status
    end,
    updated_at = now()$n$;
    if position(needle in def) = 0 then
      raise exception 'save_listing_draft status demotion was not found';
    end if;
    def := replace(def, needle, $n$updated_at = now()$n$);
  end if;

  if position('audit_action' in def) = 0 then
    needle := $n$    v_actor,
    'edit',
    v_before.status,$n$;
    replacement := $n$    v_actor,
    coalesce(nullif(btrim(coalesce(p_payload ->> 'audit_action', '')), ''), 'edit'),
    v_before.status,$n$;
    if position(needle in def) = 0 then
      raise exception 'save_listing_draft audit action was not found';
    end if;
    def := replace(def, needle, replacement);
  end if;

  if position('is_pending = false' in def) = 0 then
    needle := $n$  v_audit_after := private.listing_editor_snapshot(p_listing_id);$n$;
    replacement := $n$  if coalesce((p_payload ->> 'commit_live')::boolean, false) then
    update public.listing_media
    set is_pending = false
    where listing_id = p_listing_id
      and is_pending;
    delete from public.listing_revisions
    where listing_id = p_listing_id;
  end if;

  v_audit_after := private.listing_editor_snapshot(p_listing_id);$n$;
    if position(needle in def) = 0 then
      raise exception 'save_listing_draft audit snapshot was not found';
    end if;
    def := replace(def, needle, replacement);
  end if;

  if position('on conflict (listing_id)' in def) = 0 then
    needle := $n$    raise exception 'Listing name is required';
  end if;

  v_indoor := nullif(btrim(coalesce(v_listing ->> 'indoor_outdoor', '')), '');$n$;
    replacement := $n$    raise exception 'Listing name is required';
  end if;

  if v_before.status = 'approved'
     and coalesce((p_payload ->> 'commit_live')::boolean, false) is not true then
    insert into public.listing_revisions (listing_id, payload, state, updated_at)
    values (p_listing_id, p_payload, 'draft', now())
    on conflict (listing_id) do update
    set payload = excluded.payload,
        state = 'draft',
        updated_at = now();

    insert into public.listing_audit_events (
      listing_id, actor_id, action, from_status, to_status, before, after
    ) values (
      p_listing_id,
      v_actor,
      'edit',
      v_before.status,
      v_before.status,
      v_audit_before,
      private.payload_audit_snapshot(p_payload) || jsonb_build_object('status', v_before.status)
    );

    select * into v_after from public.directory_listings where id = p_listing_id;
    return v_after;
  end if;

  v_indoor := nullif(btrim(coalesce(v_listing ->> 'indoor_outdoor', '')), '');$n$;
    if position(needle in def) = 0 then
      raise exception 'save_listing_draft stash point was not found';
    end if;
    def := replace(def, needle, replacement);
  end if;

  execute def;
end
$save$;

do $apply$
declare
  def text := pg_get_functiondef('private.apply_listing_action(uuid, text, boolean, text, timestamptz)'::regprocedure);
  needle text;
  replacement text;
begin
  if position('listing_revisions' in def) > 0 then
    return;
  end if;

  needle := $n$  v_before public.directory_listings;
  v_after public.directory_listings;$n$;
  replacement := $n$  v_before public.directory_listings;
  v_after public.directory_listings;
  v_revision public.listing_revisions;$n$;
  if position(needle in def) = 0 then
    raise exception 'apply_listing_action declare was not found';
  end if;
  def := replace(def, needle, replacement);

  needle := $n$    raise exception 'Listing not found';
  end if;

  v_new_status := v_before.status;$n$;
  replacement := $n$    raise exception 'Listing not found';
  end if;

  if v_before.status = 'approved' then
    select * into v_revision
    from public.listing_revisions
    where listing_id = p_listing_id;

    if not found then
      if p_action = 'review' then
        raise exception 'Save the listing changes before submitting them for approval';
      end if;
    elsif p_action = 'review' then
      if v_revision.state is distinct from 'draft' then
        raise exception 'These changes are already waiting for approval';
      end if;

      update public.listing_revisions
      set state = 'review', updated_at = now()
      where listing_id = p_listing_id;

      select * into v_after
      from public.directory_listings
      where id = p_listing_id;

      insert into public.listing_audit_events (
        listing_id, actor_id, action, from_status, to_status, before, after
      ) values (
        p_listing_id,
        v_actor,
        'review',
        v_before.status,
        v_before.status,
        private.listing_editor_snapshot(p_listing_id),
        private.payload_audit_snapshot(v_revision.payload) || jsonb_build_object('status', v_before.status)
      );

      return v_after;
    elsif p_action = 'approve' then
      if v_revision.state is distinct from 'review' then
        raise exception 'Submit the changes for approval first';
      end if;

      v_after := private.save_listing_draft(
        p_listing_id,
        v_revision.payload || jsonb_build_object('commit_live', true, 'audit_action', 'approve')
      );
      return v_after;
    end if;
  end if;

  v_new_status := v_before.status;$n$;
  if position(needle in def) = 0 then
    raise exception 'apply_listing_action review point was not found';
  end if;
  def := replace(def, needle, replacement);

  execute def;
end
$apply$;
