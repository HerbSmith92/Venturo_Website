-- A send can be a reminder, a community event, an interest, the weekend, or favourites.

alter table public.push_campaigns
  add column if not exists notice_kind text;

alter table public.push_campaigns
  drop constraint if exists push_campaigns_notice_kind;

alter table public.push_campaigns
  add constraint push_campaigns_notice_kind
  check (
    notice_kind is null
    or notice_kind in ('custom', 'remind', 'community', 'interest', 'weekend', 'saved')
  );
