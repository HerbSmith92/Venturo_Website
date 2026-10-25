import { AreaGroups } from "@/components/admin/overview/AreaGroups";
import { loadAreaCoverage, sortAreaGroups } from "@/lib/area-coverage";
import type { InterestSortDir, InterestSortKey } from "@/lib/interest-rank";
import { loadExcludedIds } from "@/lib/search-misses";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COLUMNS: { key: InterestSortKey; label: string; first: InterestSortDir }[] = [
  { key: "title", label: "Area", first: "asc" },
  { key: "members", label: "Members", first: "desc" },
  { key: "listings", label: "Live listings", first: "desc" },
  { key: "memberRank", label: "Member rank", first: "asc" },
  { key: "listingRank", label: "Listing rank", first: "asc" },
  { key: "behind", label: "Gap", first: "desc" },
];

function sortKey(value: string | undefined): InterestSortKey {
  return COLUMNS.some((column) => column.key === value) ? (value as InterestSortKey) : "behind";
}

function sortDir(value: string | undefined, sort: InterestSortKey): InterestSortDir {
  if (value === "asc" || value === "desc") return value;
  return COLUMNS.find((column) => column.key === sort)?.first ?? "desc";
}

function columnHref(sort: InterestSortKey, dir: InterestSortDir, key: InterestSortKey, first: InterestSortDir) {
  const next = sort === key ? (dir === "asc" ? "desc" : "asc") : first;
  return `/admin/areas?sort=${key}&dir=${next}`;
}

export default async function ThinAreasPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const sort = sortKey(params.sort);
  const dir = sortDir(params.dir, sort);
  const service = createServiceClient();
  const excluded = await loadExcludedIds(service);
  const result = await loadAreaCoverage({
    service,
    excludedOk: excluded.ok,
    excluded: excluded.ids,
  });
  const groups = result.state === "ready" ? sortAreaGroups(result.groups, sort, dir) : [];

  return (
    <section className="ops">
      <header className="ops-head">
        <div>
          <p className="eyebrow">Control Room</p>
          <h1>Thin areas</h1>
          <p className="lede">
            Home areas members can choose, grouped by region. A listing counts when its city or suburb names that place. A region counts that listing once.
          </p>
        </div>
        <a href="/admin">Back to overview</a>
      </header>
      {result.state === "unavailable" ? <p className="ops-empty">{result.reason}</p> : null}
      {result.state === "ready" && groups.length === 0 ? <p className="ops-empty">No home areas are in the catalogue.</p> : null}
      {result.state === "ready" && groups.length > 0 ? (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column.key} aria-sort={sort === column.key ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                    <a href={columnHref(sort, dir, column.key, column.first)}>
                      {column.label}
                      {sort === column.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <AreaGroups groups={groups} />
          </table>
        </div>
      ) : null}
      <p className="ops-kicker">
        Click a heading to sort the regions, and the places inside each region. Click it again to reverse the order. Minimise a region to hide its places. Region ranks compare regions. Place ranks compare the places in that region. Gap is how far the listing rank sits behind the member rank. A highlighted row is home to more members than its listings support.
      </p>
    </section>
  );
}
