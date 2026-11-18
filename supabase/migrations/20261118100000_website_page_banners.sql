-- Editable public-page banners for Activities, Events & Communities.

alter table public.website_settings
  add column if not exists activities_banner_eyebrow text,
  add column if not exists activities_banner_title text,
  add column if not exists activities_banner_copy text,
  add column if not exists activities_banner_image_url text,
  add column if not exists activities_banner_image_alt text,
  add column if not exists events_banner_eyebrow text,
  add column if not exists events_banner_title text,
  add column if not exists events_banner_copy text,
  add column if not exists events_banner_image_url text,
  add column if not exists events_banner_image_alt text,
  add column if not exists communities_banner_eyebrow text,
  add column if not exists communities_banner_title text,
  add column if not exists communities_banner_copy text,
  add column if not exists communities_banner_image_url text,
  add column if not exists communities_banner_image_alt text;

update public.website_settings
set
  activities_banner_eyebrow = coalesce(nullif(btrim(activities_banner_eyebrow), ''), 'Activities'),
  activities_banner_title = coalesce(nullif(btrim(activities_banner_title), ''), 'Find your kind of fun.'),
  activities_banner_copy = coalesce(
    nullif(btrim(activities_banner_copy), ''),
    'Discover activities near you, from everyday escapes to bucket-list adventures.'
  ),
  activities_banner_image_url = coalesce(
    nullif(btrim(activities_banner_image_url), ''),
    '/brand/landing/next-adventure.jpg'
  ),
  activities_banner_image_alt = coalesce(
    nullif(btrim(activities_banner_image_alt), ''),
    'People heading out on their next Venturo adventure'
  ),
  events_banner_eyebrow = coalesce(nullif(btrim(events_banner_eyebrow), ''), 'Find Your Next Thrill'),
  events_banner_title = coalesce(nullif(btrim(events_banner_title), ''), 'What''s On Near You'),
  events_banner_copy = coalesce(
    nullif(btrim(events_banner_copy), ''),
    'Real plans with real people—markets, nights out, workshops, & the kind of quality time worth keeping.'
  ),
  communities_banner_eyebrow = coalesce(nullif(btrim(communities_banner_eyebrow), ''), 'Communities'),
  communities_banner_title = coalesce(nullif(btrim(communities_banner_title), ''), 'Find your kind of people.'),
  communities_banner_copy = coalesce(
    nullif(btrim(communities_banner_copy), ''),
    'Discover communities built around the things you love. Meet up, try something new & make time for good company.'
  ),
  communities_banner_image_url = coalesce(
    nullif(btrim(communities_banner_image_url), ''),
    '/brand/landing/find-your-kind-of-fun.png'
  ),
  communities_banner_image_alt = coalesce(
    nullif(btrim(communities_banner_image_alt), ''),
    'Venturo community characters gathering together'
  )
where id = 1;
