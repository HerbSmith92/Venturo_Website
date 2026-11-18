-- Public website page-banner artwork uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website',
  'website',
  true,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = coalesce(storage.buckets.file_size_limit, excluded.file_size_limit),
  allowed_mime_types = coalesce(storage.buckets.allowed_mime_types, excluded.allowed_mime_types);

drop policy if exists website_banner_public_read on storage.objects;
create policy website_banner_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'website');

drop policy if exists website_banner_staff_write on storage.objects;
create policy website_banner_staff_write
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'website' and public.is_staff())
  with check (bucket_id = 'website' and public.is_staff());
