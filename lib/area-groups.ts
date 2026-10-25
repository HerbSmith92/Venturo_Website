import { rankInterests, sortInterests, type InterestSortDir, type InterestSortKey, type RankedInterest } from "./interest-rank";

export type PlaceCoverage = {
  id: string;
  title: string;
  region: string;
  members: number;
  listingIds: string[];
};

export type AreaGroup = RankedInterest & { places: RankedInterest[] };

/** Regions ranked against each other. Places ranked inside their region. A listing counts once per region. */
export function groupAreas(places: PlaceCoverage[]): AreaGroup[] {
  const byRegion = new Map<string, PlaceCoverage[]>();
  for (const place of places) {
    const region = place.region.trim() || "—";
    const list = byRegion.get(region) ?? [];
    list.push({ ...place, region });
    byRegion.set(region, list);
  }

  const drafts = [...byRegion.entries()].map(([region, rows]) => {
    const listingIds = new Set<string>();
    for (const place of rows) {
      for (const id of place.listingIds) listingIds.add(id);
    }
    return {
      id: region,
      title: region,
      members: rows.reduce((sum, place) => sum + place.members, 0),
      listings: listingIds.size,
      places: rankInterests(
        rows.map((place) => ({
          id: place.id,
          title: place.title,
          members: place.members,
          listings: new Set(place.listingIds).size,
        })),
      ),
    };
  });

  return rankInterests(drafts).map((ranked) => {
    const draft = drafts.find((row) => row.id === ranked.id);
    return { ...ranked, places: draft?.places ?? [] };
  });
}

export function sortAreaGroups(groups: AreaGroup[], sort: InterestSortKey, dir: InterestSortDir) {
  return (sortInterests(groups, sort, dir) as AreaGroup[]).map((group) => ({
    ...group,
    places: sortInterests(group.places, sort, dir),
  }));
}
