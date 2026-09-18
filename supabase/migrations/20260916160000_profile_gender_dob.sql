-- Optional member gender & date of birth. Locked in product architecture (26 Aug 2026).
alter table public.profiles
  add column if not exists gender text,
  add column if not exists date_of_birth date;

comment on column public.profiles.gender is 'Optional member gender. App-controlled values: woman, man, non-binary, prefer-not-to-say.';
comment on column public.profiles.date_of_birth is 'Optional member date of birth.';
