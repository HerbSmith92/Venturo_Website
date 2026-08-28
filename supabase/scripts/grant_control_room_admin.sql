-- Grant Control Room access to an existing auth user.
-- Role lives in app_metadata only. Sign out & log in again after this runs.

update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'you@your-domain.co.za';
