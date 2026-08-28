-- Run in the Venturo Supabase project.
-- Roles stay in auth.users raw_app_meta_data. Paid membership is RevenueCat, not this table.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "A profile is readable by its owner"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "A profile is insertable by its owner"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "A profile is updatable by its owner"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
