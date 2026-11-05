alter table public.member_consents
  drop constraint if exists member_consents_policy_check;

alter table public.member_consents
  add constraint member_consents_policy_check
  check (policy in ('terms', 'privacy', 'host-terms'));
