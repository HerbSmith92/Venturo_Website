-- Daily public event page views, for Event Host Home totals & charts.

create table if not exists public.event_view_days (
  event_id uuid not null references public.events (id) on delete cascade,
  day date not null,
  views int not null default 0 check (views >= 0),
  primary key (event_id, day)
);

create index if not exists event_view_days_day_idx
  on public.event_view_days (day);

alter table public.event_view_days enable row level security;

create policy "Organisers and staff read event views"
  on public.event_view_days
  for select
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.events e
      where e.id = event_id
        and e.organiser_id = auth.uid()
    )
  );
