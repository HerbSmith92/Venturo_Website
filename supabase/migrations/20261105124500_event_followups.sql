-- After an event ends: host confirms it happened, ticket buyers leave a review.

create table if not exists public.event_followup_sends (
  event_id uuid primary key references public.events (id) on delete cascade,
  host_sent_at timestamptz,
  guest_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.event_host_reports (
  event_id uuid primary key references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  happened boolean not null,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_reviews_event_created_idx
  on public.event_reviews (event_id, created_at desc);

create index if not exists event_followup_sends_host_sent_idx
  on public.event_followup_sends (host_sent_at);

alter table public.event_followup_sends enable row level security;
alter table public.event_host_reports enable row level security;
alter table public.event_reviews enable row level security;

create policy event_followup_sends_staff_read
  on public.event_followup_sends
  for select
  to authenticated
  using (public.is_staff());

create policy event_host_reports_read
  on public.event_host_reports
  for select
  to authenticated
  using (public.can_manage_event(event_id) or public.is_staff());

create policy event_host_reports_write
  on public.event_host_reports
  for insert
  to authenticated
  with check (auth.uid() = user_id and public.can_manage_event(event_id));

create policy event_host_reports_update
  on public.event_host_reports
  for update
  to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

create policy event_reviews_read
  on public.event_reviews
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.can_manage_event(event_id)
    or public.is_staff()
  );

create policy event_reviews_insert
  on public.event_reviews
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.event_tickets t
      where t.event_id = event_reviews.event_id
        and t.buyer_id = auth.uid()
    )
  );

create policy event_reviews_update
  on public.event_reviews
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.event_followup_sends to authenticated;
grant select, insert, update on public.event_host_reports to authenticated;
grant select, insert, update on public.event_reviews to authenticated;
