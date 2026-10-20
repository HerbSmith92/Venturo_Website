-- Paystack replaces PayFast for new website tickets & memberships.
-- Existing payfast rows stay valid. member_access.payfast_active remains the
-- website-billing flag the app already reads.

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'memberships'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%provider%'
  loop
    execute format('alter table public.memberships drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.memberships
  add constraint memberships_provider_check
  check (provider in ('payfast', 'paystack'));

alter table public.memberships
  alter column provider set default 'paystack';

alter table public.memberships
  add column if not exists payer_email text,
  add column if not exists paystack_transaction_id text,
  add column if not exists paystack_customer_code text,
  add column if not exists paystack_subscription_code text,
  add column if not exists paystack_email_token text;

create index if not exists memberships_paystack_customer_idx
  on public.memberships (paystack_customer_code)
  where paystack_customer_code is not null;

create index if not exists memberships_paystack_subscription_idx
  on public.memberships (paystack_subscription_code)
  where paystack_subscription_code is not null;

create index if not exists memberships_payer_email_idx
  on public.memberships (payer_email)
  where payer_email is not null;
