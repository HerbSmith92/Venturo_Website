-- Website audience (Women/Men/All), event indoor/outdoor setting,
-- and at most one approved community per event.

-- Audience on listings, events & communities
alter table public.directory_listings
  add column if not exists audience text;

alter table public.events
  add column if not exists audience text;

alter table public.communities
  add column if not exists audience text;

update public.directory_listings set audience = 'all' where audience is null;
update public.events set audience = 'all' where audience is null;
update public.communities set audience = 'all' where audience is null;

alter table public.directory_listings
  alter column audience set default 'all',
  alter column audience set not null;

alter table public.events
  alter column audience set default 'all',
  alter column audience set not null;

alter table public.communities
  alter column audience set default 'all',
  alter column audience set not null;

alter table public.directory_listings
  drop constraint if exists directory_listings_audience_check;
alter table public.directory_listings
  add constraint directory_listings_audience_check
  check (audience in ('all', 'women', 'men'));

alter table public.events
  drop constraint if exists events_audience_check;
alter table public.events
  add constraint events_audience_check
  check (audience in ('all', 'women', 'men'));

alter table public.communities
  drop constraint if exists communities_audience_check;
alter table public.communities
  add constraint communities_audience_check
  check (audience in ('all', 'women', 'men'));

-- Event setting (Indoor / Outdoor / both) — same enum as listings
do $$
begin
  if not exists (select 1 from pg_type where typname = 'indoor_outdoor') then
    create type public.indoor_outdoor as enum ('indoor', 'outdoor', 'both');
  end if;
end $$;

alter table public.events
  add column if not exists indoor_outdoor public.indoor_outdoor;

-- Keep one approved link per event (oldest community_id wins) before unique index
with ranked as (
  select
    community_id,
    event_id,
    row_number() over (partition by event_id order by community_id) as rn
  from public.community_events
  where link_status = 'approved'
)
delete from public.community_events ce
using ranked r
where ce.community_id = r.community_id
  and ce.event_id = r.event_id
  and r.rn > 1;

create unique index if not exists community_events_one_approved_per_event_idx
  on public.community_events (event_id)
  where link_status = 'approved';

create index if not exists directory_listings_audience_idx
  on public.directory_listings (audience);
create index if not exists events_audience_idx
  on public.events (audience);
create index if not exists communities_audience_idx
  on public.communities (audience);
create index if not exists events_indoor_outdoor_idx
  on public.events (indoor_outdoor);
