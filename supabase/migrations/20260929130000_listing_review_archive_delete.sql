-- New listings wait in review. Archive no longer needs a rejection note.
-- A listing can be deleted only after it has been archived.

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
    'review'
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

create or replace function private.apply_listing_action(
  p_listing_id uuid,
  p_action text,
  p_featured boolean default null,
  p_note text default null,
  p_publish_at timestamptz default null
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
  v_new_status public.directory_status;
  v_featured boolean;
  v_note text;
  v_suspended boolean;
  v_publish_at timestamptz;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_role is distinct from 'admin' then
    raise exception 'Control Room actions are for admins';
  end if;
  if p_action not in ('approve', 'review', 'draft', 'archive', 'feature', 'suspend', 'unsuspend') then
    raise exception 'Unknown action';
  end if;

  select * into v_before
  from public.directory_listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  v_new_status := v_before.status;
  v_featured := v_before.is_featured;
  v_note := v_before.review_note;
  v_suspended := v_before.is_suspended;
  v_publish_at := v_before.publish_at;

  if p_action = 'approve' then
    v_new_status := 'approved';
    v_suspended := false;
    v_note := null;
    v_publish_at := p_publish_at;
  elsif p_action = 'review' then
    v_new_status := 'review';
  elsif p_action = 'draft' then
    v_new_status := 'draft';
    v_note := nullif(btrim(coalesce(p_note, '')), '');
    if v_note is null then
      raise exception 'A reason is required when you request changes';
    end if;
  elsif p_action = 'archive' then
    v_new_status := 'archived';
    v_suspended := false;
    v_note := nullif(btrim(coalesce(p_note, '')), '');
  elsif p_action = 'feature' then
    v_featured := coalesce(p_featured, not v_before.is_featured);
  elsif p_action = 'suspend' then
    v_suspended := true;
    v_note := nullif(btrim(coalesce(p_note, '')), '');
  elsif p_action = 'unsuspend' then
    v_suspended := false;
  end if;

  update public.directory_listings
  set
    status = v_new_status,
    is_featured = v_featured,
    is_suspended = v_suspended,
    review_note = v_note,
    publish_at = v_publish_at,
    published_at = case
      when p_action = 'approve' and (p_publish_at is null or p_publish_at <= now())
        then coalesce(published_at, now())
      else published_at
    end,
    last_verified_at = case
      when p_action = 'approve' then now()
      else last_verified_at
    end,
    updated_at = now()
  where id = p_listing_id
  returning * into v_after;

  insert into public.listing_audit_events (
    listing_id, actor_id, action, from_status, to_status, before, after
  ) values (
    p_listing_id,
    v_actor,
    p_action,
    v_before.status,
    v_after.status,
    jsonb_build_object(
      'status', v_before.status,
      'is_featured', v_before.is_featured,
      'is_suspended', v_before.is_suspended,
      'review_note', v_before.review_note
    ),
    jsonb_build_object(
      'status', v_after.status,
      'is_featured', v_after.is_featured,
      'is_suspended', v_after.is_suspended,
      'review_note', v_after.review_note,
      'publish_at', v_after.publish_at
    )
  );

  return v_after;
end;
$$;

create or replace function public.admin_delete_archived_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_actor uuid := (select auth.uid());
  v_status public.directory_status;
  v_business uuid;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_role is distinct from 'admin' then
    raise exception 'Control Room actions are for admins';
  end if;

  select status, business_id into v_status, v_business
  from public.directory_listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;
  if v_status is distinct from 'archived' then
    raise exception 'Only an archived listing can be deleted';
  end if;

  delete from public.directory_listings where id = p_listing_id;

  delete from public.businesses
  where id = v_business
    and not exists (
      select 1 from public.directory_listings where business_id = v_business
    );
end;
$$;

revoke all on function public.admin_delete_archived_listing(uuid) from public, anon;
grant execute on function public.admin_delete_archived_listing(uuid) to authenticated;
