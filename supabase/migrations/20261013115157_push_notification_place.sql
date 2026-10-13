-- A notification can open a guide or event, and only reach members in one place.

alter table public.push_campaigns
  add column if not exists place_id uuid references public.places (id) on delete set null,
  add column if not exists place_label text,
  add column if not exists opens_kind text,
  add column if not exists opens_id uuid,
  add column if not exists opens_label text;

alter table public.push_campaigns
  drop constraint if exists push_campaigns_opens_kind;

alter table public.push_campaigns
  add constraint push_campaigns_opens_kind
  check (opens_kind is null or opens_kind in ('guide', 'event'));

create index if not exists push_campaigns_place_id_idx
  on public.push_campaigns (place_id);
