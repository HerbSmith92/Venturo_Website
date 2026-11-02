-- Storage files are removed via the Storage API. This function only deletes the author row.

create or replace function public.admin_delete_guide_author(p_author_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role text := coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '');
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;
  if v_role is distinct from 'admin' then
    raise exception 'Admin only';
  end if;
  if p_author_id is null or not exists (select 1 from public.guide_authors where id = p_author_id) then
    raise exception 'Author not found';
  end if;

  delete from public.guide_authors
  where id = p_author_id;
end;
$$;
