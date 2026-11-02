-- Writer invites are open links. Recipients create their own Author card.
-- Role stays member (or existing staff). Do not add a fifth role.

alter table public.guide_author_invites
  alter column author_id drop not null;

alter table public.guide_author_invites
  add column if not exists email text;

drop function if exists public.admin_create_guide_author_invite(uuid);

create or replace function public.admin_create_guide_author_invite(p_email text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_admin();
  v_token text;
  v_expires timestamptz := now() + interval '14 days';
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if v_email is not null and v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Enter a valid email';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.guide_author_invites (author_id, token, created_by, expires_at, email)
  values (null, v_token, v_actor, v_expires, v_email);

  return jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires,
    'email', v_email
  );
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
begin
  select * into v_invite
  from public.guide_author_invites
  where token = btrim(coalesce(p_token, ''));
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'expires_at', v_invite.expires_at,
    'claimed', v_invite.claimed_at is not null,
    'expired', v_invite.expires_at <= now(),
    'email', v_invite.email
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
  v_author_id uuid;
  v_name text;
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

  select id into v_author_id
  from public.guide_authors
  where user_id = v_actor;

  if v_invite.claimed_at is not null then
    if v_invite.claimed_by = v_actor and v_invite.author_id is not null then
      return v_invite.author_id;
    end if;
    if v_invite.claimed_by = v_actor and v_author_id is not null then
      return v_author_id;
    end if;
    raise exception 'That invite has already been used';
  end if;

  if v_author_id is not null then
    update public.guide_author_invites
    set
      claimed_at = now(),
      claimed_by = v_actor,
      author_id = v_author_id
    where id = v_invite.id;
    return v_author_id;
  end if;

  select coalesce(nullif(btrim(display_name), ''), 'Untitled Author')
  into v_name
  from public.profiles
  where id = v_actor;
  v_name := coalesce(v_name, 'Untitled Author');

  insert into public.guide_authors (
    display_name, slug, user_id, created_by, updated_by
  ) values (
    v_name,
    private.unique_author_slug(v_name, null),
    v_actor,
    v_actor,
    v_actor
  )
  returning id into v_author_id;

  update public.guide_author_invites
  set
    claimed_at = now(),
    claimed_by = v_actor,
    author_id = v_author_id
  where id = v_invite.id;

  return v_author_id;
end;
$$;

revoke all on function public.admin_create_guide_author_invite(text) from public, anon;
grant execute on function public.admin_create_guide_author_invite(text) to authenticated;
revoke all on function public.get_guide_author_invite(text) from public;
grant execute on function public.get_guide_author_invite(text) to anon, authenticated;
revoke all on function public.claim_guide_author_invite(text) from public, anon;
grant execute on function public.claim_guide_author_invite(text) to authenticated;
