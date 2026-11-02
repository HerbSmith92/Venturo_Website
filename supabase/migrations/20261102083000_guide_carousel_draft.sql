alter table public.curated_guides
  add column if not exists carousel_draft jsonb;

create or replace function public.admin_save_guide_carousel(
  p_guide_id uuid,
  p_draft jsonb
)
returns public.curated_guides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_guide_staff();
  v_row public.curated_guides;
begin
  if p_guide_id is null then
    raise exception 'Guide is required';
  end if;
  update public.curated_guides
  set
    carousel_draft = p_draft,
    updated_at = now(),
    updated_by = v_actor
  where id = p_guide_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Guide not found';
  end if;
  return v_row;
end;
$$;

revoke all on function public.admin_save_guide_carousel(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_guide_carousel(uuid, jsonb) to authenticated;
