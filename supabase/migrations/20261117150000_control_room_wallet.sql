-- Wallet token artwork & achievement library.
-- Artwork versions never touch balances (no ledger in this migration).

create table if not exists public.wallet_token_artwork (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('draft', 'published', 'archived')),
  image_path text not null,
  file_type text,
  width_px integer,
  height_px integer,
  byte_size integer,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null
);

create unique index if not exists wallet_token_artwork_one_published
  on public.wallet_token_artwork (status)
  where status = 'published';

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  image_path text,
  tier text check (tier is null or tier in ('bronze', 'silver', 'gold', 'platinum')),
  -- Verifiable today: scanned event attendance only.
  -- Not yet supported (missing signals): activity completion, interest-linked completion,
  -- bucket-list completion, distinct business visits.
  criteria_kind text not null check (
    criteria_kind in (
      'attend_events',
      'attend_occurrences'
    )
  ),
  criteria jsonb not null default '{}'::jsonb,
  criteria_summary text not null default '',
  token_reward integer not null default 0 check (token_reward >= 0),
  sort_order integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null
);

create table if not exists public.member_achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  progress jsonb not null default '{}'::jsonb,
  reward_granted boolean not null default false,
  unique (profile_id, achievement_id)
);

create index if not exists member_achievements_profile_idx
  on public.member_achievements (profile_id, earned_at desc);

create table if not exists public.achievement_revisions (
  id uuid primary key default gen_random_uuid(),
  achievement_id uuid references public.achievements (id) on delete set null,
  action text not null,
  snapshot jsonb not null default '{}'::jsonb,
  progress_policy text not null default 'preserve_earned'
    check (progress_policy in ('preserve_earned', 'reset_progress')),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.wallet_token_artwork enable row level security;
alter table public.achievements enable row level security;
alter table public.member_achievements enable row level security;
alter table public.achievement_revisions enable row level security;

drop policy if exists wallet_token_public_read on public.wallet_token_artwork;
create policy wallet_token_public_read
  on public.wallet_token_artwork for select to public
  using (status = 'published');

drop policy if exists achievements_public_read on public.achievements;
create policy achievements_public_read
  on public.achievements for select to public
  using (status = 'published' and is_active = true);

drop policy if exists member_achievements_owner_read on public.member_achievements;
create policy member_achievements_owner_read
  on public.member_achievements for select to authenticated
  using (profile_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('wallet', 'wallet', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read wallet media" on storage.objects;
create policy "Public read wallet media"
  on storage.objects for select to public
  using (bucket_id = 'wallet');
