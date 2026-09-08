-- Ambassador networks & people. Codes hang on a network.

create table if not exists public.event_promoter_networks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.event_promoters (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  network_id uuid references public.event_promoter_networks (id) on delete set null,
  name text not null,
  email text not null,
  incentive_pct numeric(5, 2) not null default 0
    check (incentive_pct >= 0 and incentive_pct <= 100),
  created_at timestamptz not null default now()
);

alter table public.event_promo_codes
  add column if not exists network_id uuid references public.event_promoter_networks (id) on delete set null;

alter table public.event_promoter_networks enable row level security;
alter table public.event_promoters enable row level security;

drop policy if exists "Hosts read promoter networks" on public.event_promoter_networks;
drop policy if exists "Hosts write promoter networks" on public.event_promoter_networks;
drop policy if exists "Hosts update promoter networks" on public.event_promoter_networks;
drop policy if exists "Hosts delete promoter networks" on public.event_promoter_networks;
create policy "Hosts read promoter networks"
  on public.event_promoter_networks for select to authenticated
  using (public.is_event_host(event_id));
create policy "Hosts write promoter networks"
  on public.event_promoter_networks for insert to authenticated
  with check (public.is_event_host(event_id));
create policy "Hosts update promoter networks"
  on public.event_promoter_networks for update to authenticated
  using (public.is_event_host(event_id))
  with check (public.is_event_host(event_id));
create policy "Hosts delete promoter networks"
  on public.event_promoter_networks for delete to authenticated
  using (public.is_event_host(event_id));

drop policy if exists "Hosts read promoters" on public.event_promoters;
drop policy if exists "Hosts write promoters" on public.event_promoters;
drop policy if exists "Hosts update promoters" on public.event_promoters;
drop policy if exists "Hosts delete promoters" on public.event_promoters;
create policy "Hosts read promoters"
  on public.event_promoters for select to authenticated
  using (public.is_event_host(event_id));
create policy "Hosts write promoters"
  on public.event_promoters for insert to authenticated
  with check (public.is_event_host(event_id));
create policy "Hosts update promoters"
  on public.event_promoters for update to authenticated
  using (public.is_event_host(event_id))
  with check (public.is_event_host(event_id));
create policy "Hosts delete promoters"
  on public.event_promoters for delete to authenticated
  using (public.is_event_host(event_id));

notify pgrst, 'reload schema';
