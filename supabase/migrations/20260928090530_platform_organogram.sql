-- Website organogram: listing publish controls, communities, homepage
-- slots, saves, guide events, and business claims. One database for the
-- website and the Venturo app.

alter table public.directory_listings
  add column if not exists review_note text,
  add column if not exists publish_at timestamptz,
  add column if not exists is_suspended boolean not null default false;

comment on column public.directory_listings.publish_at is
  'A live listing stays off the website and app until this time.';
comment on column public.directory_listings.is_suspended is
  'Hidden from the website and app without archiving the listing.';

drop function if exists public.admin_apply_listing_action(uuid, text, boolean);
drop function if exists private.apply_listing_action(uuid, text, boolean);

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
    if v_note is null then
      raise exception 'A reason is required when you reject a listing';
    end if;
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

create or replace function public.admin_apply_listing_action(
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
begin
  return private.apply_listing_action(
    p_listing_id,
    p_action,
    p_featured,
    p_note,
    p_publish_at
  );
end;
$$;

revoke all on function public.admin_apply_listing_action(uuid, text, boolean, text, timestamptz) from public, anon;
grant execute on function public.admin_apply_listing_action(uuid, text, boolean, text, timestamptz) to authenticated;

-- Communities the app can follow. Staff publish them from Control Room.

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  about text,
  cover_url text,
  interest text,
  place_label text,
  social_url text,
  contact_email text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communities_slug_unique unique (slug)
);

create table if not exists public.community_events (
  community_id uuid not null references public.communities (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  primary key (community_id, event_id)
);

create table if not exists public.community_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, community_id)
);

alter table public.communities enable row level security;
alter table public.community_events enable row level security;
alter table public.community_follows enable row level security;

drop policy if exists communities_read on public.communities;
create policy communities_read
  on public.communities
  for select
  to anon, authenticated
  using (status = 'published' or public.is_staff());

drop policy if exists communities_staff_write on public.communities;
create policy communities_staff_write
  on public.communities
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists community_events_read on public.community_events;
create policy community_events_read
  on public.community_events
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_id
        and (c.status = 'published' or public.is_staff())
    )
  );

drop policy if exists community_events_staff_write on public.community_events;
create policy community_events_staff_write
  on public.community_events
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists community_follows_read on public.community_follows;
create policy community_follows_read
  on public.community_follows
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists community_follows_write on public.community_follows;
create policy community_follows_write
  on public.community_follows
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select on public.communities to anon, authenticated;
grant insert, update, delete on public.communities to authenticated;
grant select on public.community_events to anon, authenticated;
grant insert, update, delete on public.community_events to authenticated;
grant select, insert, update, delete on public.community_follows to authenticated;

-- Homepage and footer copy. The app reads the same featured slots.

create table if not exists public.website_settings (
  id int primary key default 1 check (id = 1),
  hero_eyebrow text,
  hero_title text,
  hero_lede text,
  hero_image_url text,
  about_title text,
  about_body text,
  help_title text,
  help_body text,
  help_email text,
  app_store_url text,
  play_store_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.website_features (
  slot text not null check (slot in ('event', 'listing', 'community', 'guide')),
  target_id uuid not null,
  sort_order int not null default 0,
  primary key (slot, target_id)
);

alter table public.website_settings enable row level security;
alter table public.website_features enable row level security;

drop policy if exists website_settings_read on public.website_settings;
create policy website_settings_read
  on public.website_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists website_settings_staff_write on public.website_settings;
create policy website_settings_staff_write
  on public.website_settings
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists website_features_read on public.website_features;
create policy website_features_read
  on public.website_features
  for select
  to anon, authenticated
  using (true);

drop policy if exists website_features_staff_write on public.website_features;
create policy website_features_staff_write
  on public.website_features
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

insert into public.website_settings (id)
values (1)
on conflict (id) do nothing;

grant select on public.website_settings to anon, authenticated;
grant insert, update, delete on public.website_settings to authenticated;
grant select on public.website_features to anon, authenticated;
grant insert, update, delete on public.website_features to authenticated;

-- Saves shared by My Venturo and the app.

create table if not exists public.member_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('listing', 'event', 'guide')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, target_id)
);

alter table public.member_saves enable row level security;

drop policy if exists member_saves_own on public.member_saves;
create policy member_saves_own
  on public.member_saves
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.member_saves to authenticated;

-- Guides can point at events as well as directory listings.

create table if not exists public.curated_guide_events (
  guide_id uuid not null references public.curated_guides (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  sort_order int not null default 0,
  primary key (guide_id, event_id)
);

alter table public.curated_guide_events enable row level security;

drop policy if exists curated_guide_events_read on public.curated_guide_events;
create policy curated_guide_events_read
  on public.curated_guide_events
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.curated_guides g
      where g.id = guide_id
        and (
          public.curated_guide_is_live(g.status, g.publish_at, g.expire_at)
          or public.is_staff()
        )
    )
  );

drop policy if exists curated_guide_events_staff_write on public.curated_guide_events;
create policy curated_guide_events_staff_write
  on public.curated_guide_events
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select on public.curated_guide_events to anon, authenticated;
grant insert, update, delete on public.curated_guide_events to authenticated;

-- Business claims. Approval still publishes through the directory queue.

create table if not exists public.listing_claims (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.directory_listings (id) on delete set null,
  listing_name text not null,
  listing_slug text,
  user_id uuid not null references auth.users (id) on delete cascade,
  evidence text not null check (char_length(btrim(evidence)) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listing_claims_status_idx
  on public.listing_claims (status, created_at desc);

alter table public.listing_claims enable row level security;

drop policy if exists listing_claims_insert on public.listing_claims;
create policy listing_claims_insert
  on public.listing_claims
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists listing_claims_read on public.listing_claims;
create policy listing_claims_read
  on public.listing_claims
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists listing_claims_staff_update on public.listing_claims;
create policy listing_claims_staff_update
  on public.listing_claims
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select, insert, update on public.listing_claims to authenticated;
