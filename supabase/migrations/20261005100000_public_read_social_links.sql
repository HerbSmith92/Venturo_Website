-- Signed-in members use the authenticated role. The public read already
-- covers anon, so extend it so a logged-in visitor can see the same links.
drop policy if exists "social_links_select_approved" on public.social_links;

create policy "social_links_select_approved"
  on public.social_links
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.directory_listings d
      where d.id = social_links.listing_id
        and d.status = 'approved'
    )
  );
