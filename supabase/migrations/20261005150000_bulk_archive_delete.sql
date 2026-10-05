alter type public.event_status add value if not exists 'archived';

create or replace function public.admin_delete_curated_guide(p_guide_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_guide_admin();
  delete from public.curated_guides where id = p_guide_id;
  if not found then
    raise exception 'Guide not found';
  end if;
end;
$$;

revoke all on function public.admin_delete_curated_guide(uuid) from public, anon;
grant execute on function public.admin_delete_curated_guide(uuid) to authenticated;
