-- Ensure onboarding catalogue media columns exist without dropping live rows.
alter table public.personas
  add column if not exists image_path text;

alter table public.interests
  add column if not exists icon_path text,
  add column if not exists image_path text,
  add column if not exists icon_version integer not null default 1,
  add column if not exists description text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.activity_scales
  add column if not exists image_path text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.bucket_items
  add column if not exists description text,
  add column if not exists updated_at timestamptz not null default now();

-- Public catalog bucket already exists in production; recreate safely if missing.
insert into storage.buckets (id, name, public)
values ('catalog', 'catalog', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read catalog media" on storage.objects;
create policy "Public read catalog media"
  on storage.objects for select to public
  using (bucket_id = 'catalog');
