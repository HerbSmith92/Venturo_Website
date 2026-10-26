alter table public.platform_fee_settings
  add column if not exists member_discount_pct numeric(5, 2) not null default 0
    check (member_discount_pct >= 0 and member_discount_pct <= 100),
  add column if not exists pass_booking_to_buyer boolean not null default false,
  add column if not exists pass_commission_to_buyer boolean not null default false;
