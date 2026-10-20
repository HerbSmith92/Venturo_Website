-- Cellphone lives on the member, then copies onto each ticket for Guest Management.
alter table public.profiles
  add column if not exists phone text;
