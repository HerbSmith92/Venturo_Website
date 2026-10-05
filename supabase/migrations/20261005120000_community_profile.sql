alter table public.communities
  add column if not exists website_url text,
  add column if not exists phone text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists founder_name text,
  add column if not exists founder_email text;
