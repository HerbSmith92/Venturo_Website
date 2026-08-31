-- Surname for member profiles. First name stays in display_name for app greeting compatibility.
alter table public.profiles
  add column if not exists last_name text;
