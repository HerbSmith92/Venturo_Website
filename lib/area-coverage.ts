import { groupAreas, type AreaGroup, type PlaceCoverage } from "@/lib/area-groups";
import { shortInterests } from "@/lib/interest-rank";
import { formatCount } from "@/lib/overview/metrics";
import { placeMentioned } from "@/lib/place-match";
import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;

export { sortAreaGroups } from "@/lib/area-groups";
export type { AreaGroup } from "@/lib/area-groups";

export async function loadAreaCoverage(input: {
  service: SupabaseClient | null;
  excludedOk: boolean;
  excluded: Set<string>;
}): Promise<{ state: "unavailable"; reason: string } | { state: "ready"; groups: AreaGroup[] }> {
  if (!input.service) {
    return { state: "unavailable", reason: "The service role key is missing, so home areas are withheld." };
  }
  if (!input.excludedOk) {
    return { state: "unavailable", reason: "Test accounts could not be listed, so home areas are withheld." };
  }

  const [places, profiles, listings] = await Promise.all([
    input.service
      .from("places")
      .select("id, name, region, is_active, is_launch_city")
      .eq("is_active", true)
      .eq("is_launch_city", true)
      .order("name")
      .limit(200),
    readPages(input.service, "profiles", "id, home_place_id"),
    input.service
      .from("directory_listings")
      .select("id, city, suburb")
      .eq("status", "approved")
      .eq("is_suspended", false)
      .limit(5000),
  ]);
  const error = places.error || profiles.error || listings.error;
  if (error) {
    return {
      state: "unavailable",
      reason: /does not exist|schema cache|Could not find the/i.test(error.message)
        ? "Home areas are not available yet."
        : "Home areas could not be read.",
    };
  }

  const catalogue = ((places.data ?? []) as { id: string; name: string; region: string | null }[]).map((row) => ({
    id: row.id,
    title: row.name.trim() || "Place",
    region: row.region?.trim() || "—",
  }));
  const members = new Map<string, number>();
  for (const row of profiles.rows) {
    const profileId = String(row.id ?? "");
    const placeId = String(row.home_place_id ?? "");
    if (!profileId || !placeId || input.excluded.has(profileId)) continue;
    members.set(placeId, (members.get(placeId) ?? 0) + 1);
  }
  const listingRows = (listings.data ?? []) as { id: string; city: string | null; suburb: string | null }[];
  const coverage: PlaceCoverage[] = catalogue.map((place) => {
    const listingIds: string[] = [];
    for (const listing of listingRows) {
      if (placeMentioned(listing.city, listing.suburb, place.title)) listingIds.push(listing.id);
    }
    return {
      id: place.id,
      title: place.title,
      region: place.region,
      members: members.get(place.id) ?? 0,
      listingIds,
    };
  });

  return { state: "ready", groups: groupAreas(coverage) };
}

function people(count: number) {
  return `${formatCount(count)} ${count === 1 ? "member" : "members"}`;
}

export function areaCoverageSummary(result: Awaited<ReturnType<typeof loadAreaCoverage>>) {
  if (result.state === "unavailable") return result.reason;
  const thinRegions = shortInterests(result.groups).slice(0, 2);
  const inner = result.groups
    .filter((group) => group.members === 0 || group.behind <= 0)
    .flatMap((group) => shortInterests(group.places).map((place) => ({ ...place, region: group.title })))
    .sort((a, b) => b.behind - a.behind || b.members - a.members || a.title.localeCompare(b.title))
    .slice(0, 2);
  const lines = [
    ...thinRegions.map((row) => `${row.title} · ${people(row.members)} · ${formatCount(row.listings)} live`),
    ...inner.map((row) => `${row.title} in ${row.region} · ${people(row.members)} · ${formatCount(row.listings)} live`),
  ];
  if (lines.length) return `${lines.join(". ")}. Members live here more often than the catalogue covers.`;
  if (!result.groups.some((row) => row.members > 0)) {
    const thin = [...result.groups].sort((a, b) => a.listings - b.listings || a.title.localeCompare(b.title)).slice(0, 3);
    if (!thin.length) return "No home areas are in the catalogue.";
    return `No member has set a home area yet. Fewest live listings: ${thin
      .map((row) => `${row.title} (${formatCount(row.listings)})`)
      .join(" · ")}.`;
  }
  return "The regions members chose most also have the most live listings.";
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
