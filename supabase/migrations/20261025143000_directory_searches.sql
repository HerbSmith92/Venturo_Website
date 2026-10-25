-- Every directory search is kept, not only the empty ones.
-- A person is still stored once per day, platform, and search.

alter table public.search_misses rename to directory_searches;

alter table public.directory_searches
  add column if not exists result_count int not null default 0 check (result_count >= 0);

comment on table public.directory_searches is
  'Directory searches, kept. result_count 0 had no matches. A person is stored once per day, platform, and search. user_id is who to contact when the search was empty.';

comment on column public.directory_searches.result_count is
  'How many listings the search returned. Zero is a search with no results.';
