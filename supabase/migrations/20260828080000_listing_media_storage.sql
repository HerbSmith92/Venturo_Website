-- Public listing-media bucket + staff write policies via JWT app_metadata.role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-media',
  'listing-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = coalesce(storage.buckets.file_size_limit, excluded.file_size_limit),
  allowed_mime_types = coalesce(storage.buckets.allowed_mime_types, excluded.allowed_mime_types);

drop policy if exists "listing_media_select_public" on storage.objects;
create policy "listing_media_select_public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'listing-media');

drop policy if exists "listing_media_staff_insert" on storage.objects;
create policy "listing_media_staff_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'listing-media'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

drop policy if exists "listing_media_staff_update" on storage.objects;
create policy "listing_media_staff_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'listing-media'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  )
  with check (
    bucket_id = 'listing-media'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

drop policy if exists "listing_media_staff_delete" on storage.objects;
create policy "listing_media_staff_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'listing-media'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

-- Table write policies so server actions can insert / reorder / delete rows.
drop policy if exists "Staff can insert listing media" on public.listing_media;
create policy "Staff can insert listing media"
  on public.listing_media
  for insert
  to authenticated
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

drop policy if exists "Staff can update listing media" on public.listing_media;
create policy "Staff can update listing media"
  on public.listing_media
  for update
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  )
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );

drop policy if exists "Staff can delete listing media" on public.listing_media;
create policy "Staff can delete listing media"
  on public.listing_media
  for delete
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );
