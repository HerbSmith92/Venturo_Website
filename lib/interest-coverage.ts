import { rankInterests, shortInterests, type RankedInterest } from "@/lib/interest-rank";
import { formatCount } from "@/lib/overview/metrics";
import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;

export async function loadInterestCoverage(input: {
  service: SupabaseClient | null;
  excludedOk: boolean;
  excluded: Set<string>;
}): Promise<{ state: "unavailable"; reason: string } | { state: "ready"; rows: RankedInterest[] }> {
  if (!input.service) {
    return { state: "unavailable", reason: "The service role key is missing, so member interest choices are withheld." };
  }
  if (!input.excludedOk) {
    return { state: "unavailable", reason: "Test accounts could not be listed, so member interest choices are withheld." };
  }

  const [kinds, interests, profiles, links, kindLinks, live] = await Promise.all([
    input.service.from("activity_kinds").select("id, title, is_active, sort_order").order("sort_order").limit(100),
    input.service.from("interests").select("id, activity_kind_id, is_active").limit(1000),
    readPages(input.service, "profile_interests", "profile_id, interest_id"),
    readPages(input.service, "listing_interests", "listing_id, interest_id"),
    readPages(input.service, "listing_activity_kinds", "listing_id, activity_kind_id"),
    input.service.from("directory_listings").select("id").eq("status", "approved").eq("is_suspended", false).limit(5000),
  ]);
  const error = kinds.error || interests.error || profiles.error || links.error || kindLinks.error || live.error;
  if (error) {
    return {
      state: "unavailable",
      reason: /does not exist|schema cache|Could not find the/i.test(error.message)
        ? "Interest choices are not available yet."
        : "Interest choices could not be read.",
    };
  }

  const kindByInterest = new Map<string, string>();
  for (const row of (interests.data ?? []) as { id: string; activity_kind_id: string | null; is_active: boolean }[]) {
    if (row.activity_kind_id) kindByInterest.set(row.id, row.activity_kind_id);
  }
  const liveIds = new Set((live.data ?? []).map((row) => row.id as string));
  const members = new Map<string, Set<string>>();
  for (const row of profiles.rows) {
    const profileId = String(row.profile_id ?? "");
    const kindId = kindByInterest.get(String(row.interest_id ?? ""));
    if (!profileId || !kindId || input.excluded.has(profileId)) continue;
    const chosen = members.get(kindId) ?? new Set<string>();
    chosen.add(profileId);
    members.set(kindId, chosen);
  }
  const listings = new Map<string, Set<string>>();
  const addListing = (kindId: string, listingId: string) => {
    if (!kindId || !liveIds.has(listingId)) return;
    const linked = listings.get(kindId) ?? new Set<string>();
    linked.add(listingId);
    listings.set(kindId, linked);
  };
  for (const row of links.rows) {
    const kindId = kindByInterest.get(String(row.interest_id ?? ""));
    if (kindId) addListing(kindId, String(row.listing_id ?? ""));
  }
  for (const row of kindLinks.rows) {
    addListing(String(row.activity_kind_id ?? ""), String(row.listing_id ?? ""));
  }

  const tallies = ((kinds.data ?? []) as { id: string; title: string; is_active: boolean }[])
    .filter((row) => row.is_active)
    .map((row) => ({
      id: row.id,
      title: row.title.trim() || "Interest",
      members: members.get(row.id)?.size ?? 0,
      listings: listings.get(row.id)?.size ?? 0,
    }));

  return { state: "ready", rows: rankInterests(tallies) };
}

export function interestCoverageSummary(result: Awaited<ReturnType<typeof loadInterestCoverage>>) {
  if (result.state === "unavailable") return result.reason;
  const short = shortInterests(result.rows).slice(0, 3);
  if (short.length) {
    const lines = short
      .map((row) => `${row.title} · ${formatCount(row.members)} members · ${formatCount(row.listings)} live`)
      .join(". ");
    return `${lines}. Members chose these more often than the catalogue covers.`;
  }
  if (!result.rows.some((row) => row.members > 0)) {
    const thin = [...result.rows].sort((a, b) => a.listings - b.listings || a.title.localeCompare(b.title)).slice(0, 3);
    if (!thin.length) return "No main interests are in the catalogue.";
    return `No member has selected an interest yet. Fewest live listings: ${thin
      .map((row) => `${row.title} (${formatCount(row.listings)})`)
      .join(" · ")}.`;
  }
  return "The main interests members chose most also have the most live listings.";
}

async function readPages(service: SupabaseClient, table: string, columns: string) {
  const rows: Record<string, string>[] = [];
  for (let from = 0; from < 20_000; from += PAGE) {
    const { data, error } = await service.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) return { error, rows };
    const page = (data ?? []) as unknown as Record<string, string>[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return { error: null, rows };
}
