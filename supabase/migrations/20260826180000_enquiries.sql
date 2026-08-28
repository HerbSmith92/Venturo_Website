-- Contact & listing enquiries from the public website.

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('person', 'business')),
  name text not null,
  email text not null,
  phone text,
  business_name text,
  area text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.enquiries enable row level security;

-- Public site inserts through the authenticated or anonymous key.
-- Tighten this once an Edge Function or service role insert is in place.
create policy "Anyone can send an enquiry"
  on public.enquiries
  for insert
  to anon, authenticated
  with check (true);

create policy "Staff can read enquiries"
  on public.enquiries
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'editor')
  );
