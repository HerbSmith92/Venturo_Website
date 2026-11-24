-- Native apps query directory_listings / events / communities directly.
-- Website discovery already filters via lib/audience.ts.
--
-- Outstanding: add SELECT policies (or tighten existing ones) so anon/authenticated
-- public discovery rows respect audience using profiles.gender, without breaking
-- host/editor draft access, ticket paths, or staff overrides.
--
-- Helper (safe to create now; policies intentionally not auto-applied until audited):

create or replace function public.viewer_can_see_audience(p_audience text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case lower(coalesce(p_audience, 'all'))
    when 'all' then true
    when 'women' then exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.gender = 'woman'
    )
    when 'men' then exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.gender = 'man'
    )
    else true
  end;
$$;

revoke all on function public.viewer_can_see_audience(text) from public;
grant execute on function public.viewer_can_see_audience(text) to anon, authenticated;

comment on function public.viewer_can_see_audience(text) is
  'Eligibility helper for content audience. Wire into public SELECT policies after auditing existing listing/event/community policies.';
