-- App home configuration for Discover / Events / Community.
-- Website homepage curation (website_features) stays separate.

create table if not exists public.app_home_screens (
  screen text primary key check (screen in ('discover', 'events', 'community')),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.app_home_screens (screen)
values ('discover'), ('events'), ('community')
on conflict (screen) do nothing;

create table if not exists public.app_home_banners (
  id uuid primary key default gen_random_uuid(),
  screen text not null references public.app_home_screens (screen) on delete cascade,
  admin_name text not null default '',
  title text,
  supporting_text text,
  button_label text,
  image_path text,
  focal_x numeric(4,3) not null default 0.500,
  focal_y numeric(4,3) not null default 0.500,
  destination_kind text check (
    destination_kind is null
    or destination_kind in ('activity', 'event', 'community', 'guide', 'external', 'none')
  ),
  destination_id uuid,
  destination_url text,
  sort_order integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  published_by uuid references auth.users (id) on delete set null
);

create index if not exists app_home_banners_screen_sort_idx
  on public.app_home_banners (screen, sort_order, created_at);

create table if not exists public.app_home_rows (
  id uuid primary key default gen_random_uuid(),
  screen text not null references public.app_home_screens (screen) on delete cascade,
  row_kind text not null check (row_kind in ('hot', 'featured', 'custom')),
  admin_name text not null default '',
  public_title text,
  public_description text,
  selection_mode text not null default 'manual'
    check (selection_mode in ('manual', 'automatic', 'filter')),
  selection_rules jsonb not null default '{}'::jsonb,
  max_items integer not null default 12,
  view_all_kind text check (
    view_all_kind is null
    or view_all_kind in ('activity', 'event', 'community', 'guide', 'external', 'none')
  ),
  view_all_id uuid,
  view_all_url text,
  sort_order integer not null default 100,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  published_by uuid references auth.users (id) on delete set null
);

create unique index if not exists app_home_rows_unique_system
  on public.app_home_rows (screen, row_kind)
  where row_kind in ('hot', 'featured') and status <> 'archived';

create index if not exists app_home_rows_screen_sort_idx
  on public.app_home_rows (screen, sort_order, created_at);

create table if not exists public.app_home_row_items (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references public.app_home_rows (id) on delete cascade,
  item_kind text not null check (item_kind in ('activity', 'event', 'community', 'guide')),
  item_id uuid not null,
  sort_order integer not null default 1,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (row_id, item_kind, item_id)
);

create index if not exists app_home_row_items_row_sort_idx
  on public.app_home_row_items (row_id, sort_order);

create table if not exists public.app_home_revisions (
  id uuid primary key default gen_random_uuid(),
  screen text not null references public.app_home_screens (screen) on delete cascade,
  entity_kind text not null check (entity_kind in ('banner', 'row', 'settings')),
  entity_id uuid,
  action text not null,
  snapshot jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.app_home_screens enable row level security;
alter table public.app_home_banners enable row level security;
alter table public.app_home_rows enable row level security;
alter table public.app_home_row_items enable row level security;
alter table public.app_home_revisions enable row level security;

drop policy if exists app_home_screens_public_read on public.app_home_screens;
create policy app_home_screens_public_read
  on public.app_home_screens for select to public
  using (true);

drop policy if exists app_home_banners_public_read on public.app_home_banners;
create policy app_home_banners_public_read
  on public.app_home_banners for select to public
  using (status = 'published' and is_active = true);

drop policy if exists app_home_rows_public_read on public.app_home_rows;
create policy app_home_rows_public_read
  on public.app_home_rows for select to public
  using (status = 'published' and is_active = true);

drop policy if exists app_home_row_items_public_read on public.app_home_row_items;
create policy app_home_row_items_public_read
  on public.app_home_row_items for select to public
  using (
    exists (
      select 1
      from public.app_home_rows r
      where r.id = row_id
        and r.status = 'published'
        and r.is_active = true
    )
  );

-- Seed Hot + Featured rows per screen when missing.
insert into public.app_home_rows (screen, row_kind, admin_name, public_title, selection_mode, sort_order, status, is_active)
select s.screen, 'hot', 'Hot on Venturo', 'Hot on Venturo', 'automatic', 20, 'published', true
from public.app_home_screens s
where not exists (
  select 1 from public.app_home_rows r
  where r.screen = s.screen and r.row_kind = 'hot' and r.status <> 'archived'
);

insert into public.app_home_rows (screen, row_kind, admin_name, public_title, selection_mode, sort_order, status, is_active)
select s.screen, 'featured', 'Featured', 'Featured', 'manual', 30, 'published', true
from public.app_home_screens s
where not exists (
  select 1 from public.app_home_rows r
  where r.screen = s.screen and r.row_kind = 'featured' and r.status <> 'archived'
);

insert into storage.buckets (id, name, public)
values ('app-home', 'app-home', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read app home media" on storage.objects;
create policy "Public read app home media"
  on storage.objects for select to public
  using (bucket_id = 'app-home');
