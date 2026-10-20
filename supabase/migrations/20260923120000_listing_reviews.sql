-- One member review per person per listing. Public read. The author can insert and update their own row.

create table if not exists public.listing_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.directory_listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, user_id)
);

create index if not exists listing_reviews_listing_created_idx
  on public.listing_reviews (listing_id, created_at desc);

alter table public.listing_reviews enable row level security;

drop policy if exists listing_reviews_read on public.listing_reviews;
create policy listing_reviews_read
  on public.listing_reviews
  for select
  to anon, authenticated
  using (true);

drop policy if exists listing_reviews_insert on public.listing_reviews;
create policy listing_reviews_insert
  on public.listing_reviews
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists listing_reviews_update on public.listing_reviews;
create policy listing_reviews_update
  on public.listing_reviews
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.listing_reviews to anon, authenticated;
grant insert, update on public.listing_reviews to authenticated;
