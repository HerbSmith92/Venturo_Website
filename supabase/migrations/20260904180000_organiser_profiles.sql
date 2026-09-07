-- Public Event Host profile. Separate from member `profiles` and payout bank.
create table if not exists public.organiser_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  host_name text not null,
  contact_email text,
  description text,
  banner_url text,
  telephone text,
  telephone_public boolean not null default false,
  mobile text,
  mobile_public boolean not null default false,
  address_line1 text,
  address_line2 text,
  suburb text,
  city text,
  postal_code text,
  facebook_url text,
  website_url text,
  instagram_url text,
  spotify_url text,
  x_handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organiser_profiles enable row level security;

create policy "Owner or staff can read host profile"
  on public.organiser_profiles
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy "Owner can insert host profile"
  on public.organiser_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Owner can update host profile"
  on public.organiser_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
