-- Host updates are a readable notice. The inbox row carries the same kind the phone can see.

alter table public.push_inbox
  add column if not exists notice_kind text;

alter table public.push_campaigns
  drop constraint if exists push_campaigns_notice_kind;

alter table public.push_campaigns
  add constraint push_campaigns_notice_kind
  check (
    notice_kind is null
    or notice_kind in (
      'custom', 'remind', 'community', 'interest', 'weekend', 'saved', 'event_update'
    )
  );

notify pgrst, 'reload schema';
