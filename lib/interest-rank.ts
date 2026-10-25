export type InterestTally = {
  id: string;
  title: string;
  members: number;
  listings: number;
};

export type RankedInterest = InterestTally & {
  memberRank: number;
  listingRank: number;
  /** Positive when the listing rank is worse than the member rank. */
  behind: number;
};

function competitionRank(sorted: InterestTally[], value: (row: InterestTally) => number) {
  const ranks = new Map<string, number>();
  sorted.forEach((row, index) => {
    const previous = sorted[index - 1];
    const rank = previous && value(previous) === value(row) ? ranks.get(previous.id) ?? index + 1 : index + 1;
    ranks.set(row.id, rank);
  });
  return ranks;
}

/** Member rank 1 is chosen most. Listing rank 1 has the most live listings. */
export function rankInterests(rows: InterestTally[]): RankedInterest[] {
  const byMembers = [...rows].sort((a, b) => b.members - a.members || a.title.localeCompare(b.title));
  const byListings = [...rows].sort((a, b) => b.listings - a.listings || a.title.localeCompare(b.title));
  const memberRank = competitionRank(byMembers, (row) => row.members);
  const listingRank = competitionRank(byListings, (row) => row.listings);
  return rows.map((row) => {
    const members = memberRank.get(row.id) ?? rows.length;
    const listings = listingRank.get(row.id) ?? rows.length;
    return { ...row, memberRank: members, listingRank: listings, behind: listings - members };
  });
}

export function shortInterests(rows: RankedInterest[]) {
  return [...rows]
    .filter((row) => row.members > 0 && row.behind > 0)
    .sort((a, b) => b.behind - a.behind || b.members - a.members || a.title.localeCompare(b.title));
}

export type InterestSortKey = "title" | "members" | "listings" | "memberRank" | "listingRank" | "behind";
export type InterestSortDir = "asc" | "desc";

export function sortInterests(rows: RankedInterest[], sort: InterestSortKey, dir: InterestSortDir) {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[sort];
    const right = b[sort];
    if (typeof left === "string" && typeof right === "string") {
      const compared = left.localeCompare(right);
      if (compared !== 0) return compared * sign;
    } else if (left !== right) {
      return ((left as number) - (right as number)) * sign;
    }
    return a.title.localeCompare(b.title);
  });
}
