-- Cover photo path and the listing ids a member has opened, shared across phones.

alter table public.profiles
  add column if not exists cover_path text,
  add column if not exists viewed_listing_ids text[] not null default '{}';

comment on column public.profiles.cover_path is 'Path in the avatars bucket for the member cover photo.';
comment on column public.profiles.viewed_listing_ids is 'Listing ids this member has opened, shared across phones.';
