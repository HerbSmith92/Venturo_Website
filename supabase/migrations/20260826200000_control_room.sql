-- Control Room: staff reads, privileged publish, audit log.
-- Roles stay in auth.users raw_app_meta_data (JWT app_metadata.role).

create table if not exists public.listing_audit_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.directory_listings (id) on delete cascade,
  actor_id uuid not null,
  action text not null,
  from_status public.directory_status,
  to_status public.directory_status,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

alter table public.listing_audit_events enable row level security;

create policy "Staff can read listing audit"
  on public.listing_audit_events
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all listings"
  on public.directory_listings
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all businesses"
  on public.businesses
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all listing media"
  on public.listing_media
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all listing activities"
  on public.listing_activities
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all listing activity kinds"
  on public.listing_activity_kinds
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all listing interests"
  on public.listing_interests
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all listing personas"
  on public.listing_personas
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all listing activity scales"
  on public.listing_activity_scales
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all operating hours"
  on public.operating_hours
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all price options"
  on public.price_options
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all price extras"
  on public.price_extras
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read all social links"
  on public.social_links
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create policy "Staff can read profiles"
  on public.profiles
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

create or replace function private.apply_listing_action(
  p_listing_id uuid,
  p_action text,
  p_featured boolean default null
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
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_role is distinct from 'admin' then
    raise exception 'Control Room actions are for admins';
  end if;
  if p_action not in ('approve', 'review', 'draft', 'archive', 'feature') then
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

  if p_action = 'approve' then
    v_new_status := 'approved';
  elsif p_action = 'review' then
    v_new_status := 'review';
  elsif p_action = 'draft' then
    v_new_status := 'draft';
  elsif p_action = 'archive' then
    v_new_status := 'archived';
  elsif p_action = 'feature' then
    v_featured := coalesce(p_featured, not v_before.is_featured);
  end if;

  update public.directory_listings
  set
    status = v_new_status,
    is_featured = v_featured,
    published_at = case
      when p_action = 'approve' then coalesce(published_at, now())
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
    jsonb_build_object('status', v_before.status, 'is_featured', v_before.is_featured),
    jsonb_build_object('status', v_after.status, 'is_featured', v_after.is_featured)
  );

  return v_after;
end;
$$;

create or replace function public.admin_apply_listing_action(
  p_listing_id uuid,
  p_action text,
  p_featured boolean default null
)
returns public.directory_listings
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.apply_listing_action(p_listing_id, p_action, p_featured);
end;
$$;

revoke all on function public.admin_apply_listing_action(uuid, text, boolean) from public, anon;
grant execute on function public.admin_apply_listing_action(uuid, text, boolean) to authenticated;
