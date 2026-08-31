-- App + website share these columns. Do not invent a parallel events model.

alter table public.events
  add column if not exists audience_gender text not null default 'Everyone',
  add column if not exists story_image_url text;

alter table public.event_ticket_types
  add column if not exists member_discount_kind text not null default 'none',
  add column if not exists member_discount_value numeric(10, 2),
  add column if not exists members_only boolean not null default false;

do $$ begin
  alter table public.event_ticket_types
    add constraint event_ticket_types_member_discount_kind_check
    check (member_discount_kind in ('none', 'percent', 'amount'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_ticket_types
    add constraint event_ticket_types_member_discount_value_check
    check (member_discount_value is null or member_discount_value >= 0);
exception when duplicate_object then null;
end $$;
