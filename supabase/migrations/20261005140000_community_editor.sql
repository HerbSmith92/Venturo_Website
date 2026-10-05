alter table public.communities
  add column if not exists areas text[] not null default '{}',
  add column if not exists tiktok_url text,
  add column if not exists interest_keywords text,
  add column if not exists scale_id uuid references public.activity_scales (id) on delete set null;

alter table public.community_events
  add column if not exists link_status text not null default 'approved';

alter table public.community_events
  drop constraint if exists community_events_link_status_check;

alter table public.community_events
  add constraint community_events_link_status_check
  check (link_status in ('pending', 'approved'));

create table if not exists public.community_photos (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  storage_key text not null,
  public_url text not null,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.community_activity_kinds (
  community_id uuid not null references public.communities (id) on delete cascade,
  activity_kind_id uuid not null references public.activity_kinds (id) on delete cascade,
  primary key (community_id, activity_kind_id)
);

create table if not exists public.community_personas (
  community_id uuid not null references public.communities (id) on delete cascade,
  persona_id uuid not null references public.personas (id) on delete cascade,
  primary key (community_id, persona_id)
);

alter table public.community_photos enable row level security;
alter table public.community_activity_kinds enable row level security;
alter table public.community_personas enable row level security;

drop policy if exists community_photos_read on public.community_photos;
create policy community_photos_read
  on public.community_photos
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_id
        and (c.status = 'published' or public.is_staff())
    )
  );

drop policy if exists community_photos_staff_write on public.community_photos;
create policy community_photos_staff_write
  on public.community_photos
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists community_kinds_read on public.community_activity_kinds;
create policy community_kinds_read
  on public.community_activity_kinds
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_id
        and (c.status = 'published' or public.is_staff())
    )
  );

drop policy if exists community_kinds_staff_write on public.community_activity_kinds;
create policy community_kinds_staff_write
  on public.community_activity_kinds
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists community_personas_read on public.community_personas;
create policy community_personas_read
  on public.community_personas
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_id
        and (c.status = 'published' or public.is_staff())
    )
  );

drop policy if exists community_personas_staff_write on public.community_personas;
create policy community_personas_staff_write
  on public.community_personas
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists community_events_owner_insert on public.community_events;
create policy community_events_owner_insert
  on public.community_events
  for insert
  to authenticated
  with check (
    link_status = 'pending'
    and exists (
      select 1 from public.communities c
      where c.id = community_id
        and c.created_by = auth.uid()
    )
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.organiser_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = coalesce(storage.buckets.file_size_limit, excluded.file_size_limit),
  allowed_mime_types = coalesce(storage.buckets.allowed_mime_types, excluded.allowed_mime_types);

drop policy if exists community_media_select_public on storage.objects;
create policy community_media_select_public
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'community-media');

drop policy if exists community_media_staff_insert on storage.objects;
create policy community_media_staff_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'community-media'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

drop policy if exists community_media_staff_update on storage.objects;
create policy community_media_staff_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'community-media'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  )
  with check (
    bucket_id = 'community-media'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

drop policy if exists community_media_staff_delete on storage.objects;
create policy community_media_staff_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'community-media'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

grant select on public.community_photos to anon, authenticated;
grant insert, update, delete on public.community_photos to authenticated;
grant select on public.community_activity_kinds to anon, authenticated;
grant insert, update, delete on public.community_activity_kinds to authenticated;
grant select on public.community_personas to anon, authenticated;
grant insert, update, delete on public.community_personas to authenticated;
