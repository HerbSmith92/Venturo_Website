alter table public.communities
  drop constraint if exists communities_status_check;

alter table public.communities
  add constraint communities_status_check
  check (status in ('draft', 'requested', 'published', 'archived', 'suspended'));
