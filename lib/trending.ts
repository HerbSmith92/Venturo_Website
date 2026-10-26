import { searchDirectory, type Listing } from "@/lib/listings";
import { loadExcludedIds } from "@/lib/search-misses";
import { createServiceClient } from "@/lib/supabase/admin";

const WINDOW_DAYS = 90;

type SearchHit = {
  query: string;
  category: string;
  times: number;
};

export type TrendingDirectory = {
  listings: Listing[];
  seeAllHref: string | null;
};

/** Listings behind the searches people actually ran. Hidden when nothing matches. */
export async function loadTrendingDirectory(limit = 10): Promise<TrendingDirectory> {
  const service = createServiceClient();
  if (!service) return { listings: [], seeAllHref: null };

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await service
    .from("directory_searches")
    .select("query, category, user_id")
    .gte("searched_at", since)
    .limit(2000);
  if (error || !data) return { listings: [], seeAllHref: null };

  const excluded = await loadExcludedIds(service);
  const grouped = new Map<string, SearchHit>();
  for (const row of data) {
    if (excluded.ok && row.user_id && excluded.ids.has(row.user_id)) continue;
    const query = String(row.query ?? "").trim();
    const category = String(row.category ?? "").trim();
    if (!query && !category) continue;
    const key = `${query.toLowerCase()}|${category}`;
    const current = grouped.get(key) ?? { query, category, times: 0 };
    current.times += 1;
    grouped.set(key, current);
  }

  const terms = [...grouped.values()].sort((a, b) => {
    if (b.times !== a.times) return b.times - a.times;
    if (Boolean(b.query) !== Boolean(a.query)) return b.query ? 1 : -1;
    return a.query.localeCompare(b.query);
  });

  const seen = new Set<string>();
  const listings: Listing[] = [];
  const pools: Listing[][] = [];
  for (const term of terms) {
    if (listings.length >= limit) break;
    const matches = await searchDirectory({
      q: term.query || undefined,
      category: term.category || "all",
    });
    pools.push(matches);
    const next = matches.find((listing) => !seen.has(listing.id));
    if (!next) continue;
    seen.add(next.id);
    listings.push(next);
  }

  for (const pool of pools) {
    if (listings.length >= limit) break;
    for (const listing of pool) {
      if (listings.length >= limit) break;
      if (seen.has(listing.id)) continue;
      seen.add(listing.id);
      listings.push(listing);
    }
  }

  const lead = terms[0];
  const seeAllHref = !lead
    ? null
    : lead.query
      ? `/directory?q=${encodeURIComponent(lead.query)}`
      : `/directory?category=${encodeURIComponent(lead.category)}`;

  return { listings: listings.slice(0, limit), seeAllHref };
}
