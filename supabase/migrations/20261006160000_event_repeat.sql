alter table public.events
  add column if not exists repeat_every text,
  add column if not exists repeat_until timestamptz;

alter table public.events
  drop constraint if exists events_repeat_every_check;

alter table public.events
  add constraint events_repeat_every_check
  check (
    repeat_every is null
    or repeat_every in ('week', 'month')
    or repeat_every ~ '^(first|second|third|fourth|last)-(mon|tue|wed|thu|fri|sat|sun)$'
  );
