-- Invite a person to claim an Author card, fill their profile, and write Guides.
-- Role stays member (or existing staff). Do not add a fifth role.

create table if not exists public.guide_author_invites (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.guide_authors (id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  claimed_at timestamptz,
  claimed_by uuid references auth.users (id) on delete set null
);

create index if not exists guide_author_invites_author_idx
  on public.guide_author_invites (author_id, created_at desc);

alter table public.guide_author_invites enable row level security;

revoke all on public.guide_author_invites from public, anon, authenticated;

create or replace function private.require_guide_staff()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_role in ('admin', 'editor') then
    return v_actor;
  end if;
  if exists (select 1 from public.guide_authors where user_id = v_actor) then
    return v_actor;
  end if;
  raise exception 'You need an author invite or a staff login';
end;
$$;

create or replace function public.admin_save_guide_author(
  p_author_id uuid,
  p_payload jsonb
)
returns public.guide_authors
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
  v_name text;
  v_slug text;
  v_user uuid;
  v_after public.guide_authors;
  v_existing public.guide_authors;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Save payload required';
  end if;

  select * into v_existing
  from public.guide_authors
  where id = p_author_id;
  if not found then
    raise exception 'Author not found';
  end if;

  if v_role is distinct from 'admin' then
    if v_existing.user_id is distinct from v_actor then
      raise exception 'You can only edit your own author profile';
    end if;
  end if;

  v_name := btrim(coalesce(p_payload ->> 'display_name', ''));
  if v_name = '' or v_name = 'Untitled Author' then
    raise exception 'Author name is required';
  end if;

  if v_role = 'admin' then
    begin
      v_user := nullif(btrim(coalesce(p_payload ->> 'user_id', '')), '')::uuid;
    exception when invalid_text_representation then
      v_user := null;
    end;
    if v_user is not null and not exists (select 1 from auth.users where id = v_user) then
      raise exception 'Unknown staff user';
    end if;
  else
    v_user := v_existing.user_id;
  end if;

  v_slug := public.slugify(coalesce(p_payload ->> 'slug', v_name));
  if v_slug is null or v_slug = '' then
    v_slug := private.unique_author_slug(v_name, p_author_id);
  else
    if exists (
      select 1 from public.guide_authors
      where slug = v_slug and id is distinct from p_author_id
    ) then
      v_slug := private.unique_author_slug(v_slug, p_author_id);
    end if;
  end if;

  update public.guide_authors
  set
    display_name = v_name,
    slug = v_slug,
    tagline = nullif(btrim(coalesce(p_payload ->> 'tagline', '')), ''),
    bio = nullif(btrim(coalesce(p_payload ->> 'bio', '')), ''),
    photo_url = nullif(btrim(coalesce(p_payload ->> 'photo_url', '')), ''),
    photo_storage_key = nullif(btrim(coalesce(p_payload ->> 'photo_storage_key', '')), ''),
    instagram_url = nullif(btrim(coalesce(p_payload ->> 'instagram_url', '')), ''),
    tiktok_url = nullif(btrim(coalesce(p_payload ->> 'tiktok_url', '')), ''),
    facebook_url = nullif(btrim(coalesce(p_payload ->> 'facebook_url', '')), ''),
    website_url = nullif(btrim(coalesce(p_payload ->> 'website_url', '')), ''),
    user_id = v_user,
    updated_by = v_actor,
    updated_at = now()
  where id = p_author_id
  returning * into v_after;

  return v_after;
end;
$$;

create or replace function public.admin_create_guide_author_invite(p_author_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_token text;
  v_expires timestamptz := now() + interval '14 days';
begin
  if not exists (select 1 from public.guide_authors where id = p_author_id) then
    raise exception 'Author not found';
  end if;

  update public.guide_author_invites inv
  set expires_at = now()
  where inv.author_id = p_author_id
    and inv.claimed_at is null
    and inv.expires_at > now();

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.guide_author_invites (author_id, token, created_by, expires_at)
  values (p_author_id, v_token, v_actor, v_expires);

  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$$;

create or replace function public.get_guide_author_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.guide_author_invites;
  v_name text;
begin
  select * into v_invite
  from public.guide_author_invites
  where token = btrim(coalesce(p_token, ''));
  if not found then
    return null;
  end if;

  select display_name into v_name
  from public.guide_authors
  where id = v_invite.author_id;

  return jsonb_build_object(
    'author_id', v_invite.author_id,
    'display_name', case when v_name is null or v_name = 'Untitled Author' then null else v_name end,
    'expires_at', v_invite.expires_at,
    'claimed', v_invite.claimed_at is not null,
    'expired', v_invite.expires_at <= now()
  );
end;
$$;

create or replace function public.claim_guide_author_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_invite public.guide_author_invites;
  v_author public.guide_authors;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;

  select * into v_invite
  from public.guide_author_invites
  where token = btrim(coalesce(p_token, ''))
  for update;
  if not found then
    raise exception 'That invite is not valid';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'That invite has expired';
  end if;

  select * into v_author
  from public.guide_authors
  where id = v_invite.author_id
  for update;

  if v_invite.claimed_at is not null then
    if v_invite.claimed_by = v_actor then
      return v_invite.author_id;
    end if;
    raise exception 'That invite has already been used';
  end if;

  if v_author.user_id is not null and v_author.user_id is distinct from v_actor then
    raise exception 'This author is already linked to an account';
  end if;

  if exists (
    select 1 from public.guide_authors
    where user_id = v_actor and id is distinct from v_author.id
  ) then
    raise exception 'This login already has an author profile';
  end if;

  update public.guide_authors
  set
    user_id = v_actor,
    updated_by = v_actor,
    updated_at = now()
  where id = v_author.id;

  update public.guide_author_invites
  set claimed_at = now(), claimed_by = v_actor
  where id = v_invite.id;

  return v_author.id;
end;
$$;

drop policy if exists curated_guides_writer_read on public.curated_guides;
create policy curated_guides_writer_read
  on public.curated_guides
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or author_id in (select id from public.guide_authors where user_id = auth.uid())
  );

drop policy if exists curated_guide_items_writer_read on public.curated_guide_items;
create policy curated_guide_items_writer_read
  on public.curated_guide_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.curated_guides g
      where g.id = guide_id
        and (
          g.created_by = auth.uid()
          or g.author_id in (select id from public.guide_authors where user_id = auth.uid())
        )
    )
  );

drop policy if exists curated_event_guides_writer_read on public.curated_event_guides;
create policy curated_event_guides_writer_read
  on public.curated_event_guides
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or author_id in (select id from public.guide_authors where user_id = auth.uid())
  );

drop policy if exists curated_event_guide_items_writer_read on public.curated_event_guide_items;
create policy curated_event_guide_items_writer_read
  on public.curated_event_guide_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.curated_event_guides g
      where g.id = guide_id
        and (
          g.created_by = auth.uid()
          or g.author_id in (select id from public.guide_authors where user_id = auth.uid())
        )
    )
  );

drop policy if exists guide_authors_media_insert on storage.objects;
create policy guide_authors_media_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'guide-authors'
    and (
      coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
      or exists (
        select 1 from public.guide_authors a
        where a.id::text = (storage.foldername(name))[1]
          and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists guide_authors_media_update on storage.objects;
create policy guide_authors_media_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'guide-authors'
    and (
      coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
      or exists (
        select 1 from public.guide_authors a
        where a.id::text = (storage.foldername(name))[1]
          and a.user_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'guide-authors'
    and (
      coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
      or exists (
        select 1 from public.guide_authors a
        where a.id::text = (storage.foldername(name))[1]
          and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists guide_authors_media_delete on storage.objects;
create policy guide_authors_media_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'guide-authors'
    and (
      coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
      or exists (
        select 1 from public.guide_authors a
        where a.id::text = (storage.foldername(name))[1]
          and a.user_id = auth.uid()
      )
    )
  );

revoke all on function public.admin_create_guide_author_invite(uuid) from public, anon;
grant execute on function public.admin_create_guide_author_invite(uuid) to authenticated;
revoke all on function public.get_guide_author_invite(text) from public;
grant execute on function public.get_guide_author_invite(text) to anon, authenticated;
revoke all on function public.claim_guide_author_invite(text) from public, anon;
grant execute on function public.claim_guide_author_invite(text) to authenticated;
grant execute on function public.admin_save_guide_author(uuid, jsonb) to authenticated;
