-- Spotlight Guides: one linked activity, editorial story blocks, independent photo placements.
-- Collection Guides stay round-up lists. Roles stay in app_metadata.

alter type public.curated_guide_status add value if not exists 'review';
alter type public.curated_guide_status add value if not exists 'changes';

alter table public.curated_guides
  add column if not exists listing_id uuid references public.directory_listings (id) on delete set null,
  add column if not exists story jsonb not null default '[]'::jsonb,
  add column if not exists photos jsonb not null default '[]'::jsonb,
  add column if not exists cover jsonb not null default '{}'::jsonb,
  add column if not exists review_note text,
  add column if not exists published_snapshot jsonb;

create index if not exists curated_guides_listing_idx on public.curated_guides (listing_id);

insert into storage.buckets (id, name, public)
values ('guide-spotlight', 'guide-spotlight', true)
on conflict (id) do nothing;

drop policy if exists guide_spotlight_public_read on storage.objects;
create policy guide_spotlight_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'guide-spotlight');

drop policy if exists guide_spotlight_staff_write on storage.objects;
create policy guide_spotlight_staff_write
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'guide-spotlight'
    and (
      public.is_staff()
      or exists (select 1 from public.guide_authors a where a.user_id = auth.uid())
    )
  );

drop policy if exists guide_spotlight_staff_update on storage.objects;
create policy guide_spotlight_staff_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'guide-spotlight'
    and (
      public.is_staff()
      or exists (select 1 from public.guide_authors a where a.user_id = auth.uid())
    )
  )
  with check (
    bucket_id = 'guide-spotlight'
    and (
      public.is_staff()
      or exists (select 1 from public.guide_authors a where a.user_id = auth.uid())
    )
  );

drop policy if exists guide_spotlight_staff_delete on storage.objects;
create policy guide_spotlight_staff_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'guide-spotlight'
    and (
      public.is_staff()
      or exists (select 1 from public.guide_authors a where a.user_id = auth.uid())
    )
  );

create or replace function private.create_curated_guide()
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_curated_guide('roundup');
end;
$$;

create or replace function private.create_curated_guide(p_shape text)
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_staff();
  v_row public.curated_guides;
  v_shape public.curated_guide_shape := private.resolve_guide_shape(jsonb_build_object('shape', p_shape));
begin
  insert into public.curated_guides (
    title, slug, status, shape, author_id, created_by, updated_by
  ) values (
    'Untitled Guide',
    private.unique_guide_slug('Untitled Guide', null),
    'draft',
    v_shape,
    private.linked_guide_author(v_actor),
    v_actor,
    v_actor
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.admin_create_curated_guide()
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_curated_guide('roundup');
end;
$$;

create or replace function public.admin_create_curated_guide(p_shape text)
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_curated_guide(p_shape);
end;
$$;

revoke all on function public.admin_create_curated_guide(text) from public, anon;
grant execute on function public.admin_create_curated_guide(text) to authenticated;
