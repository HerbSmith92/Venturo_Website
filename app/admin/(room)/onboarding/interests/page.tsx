import { InterestManager } from "@/components/admin/InterestManager";
import { requireAdmin } from "@/lib/auth";
import { loadCatalogAdmin } from "@/lib/catalog-admin";
import { loadInterestCoverage } from "@/lib/interest-coverage";
import { sortInterests, type InterestSortDir, type InterestSortKey } from "@/lib/interest-rank";
import { formatCount } from "@/lib/overview/metrics";
import { loadExcludedIds } from "@/lib/search-misses";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COLUMNS: { key: InterestSortKey; label: string; first: InterestSortDir }[] = [
  { key: "title", label: "Interest", first: "asc" },
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
  return `/admin/onboarding/interests?sort=${key}&dir=${next}`;
}

export default async function OnboardingInterestsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const sort = sortKey(params.sort);
  const dir = sortDir(params.dir, sort);
  const service = createServiceClient();
  const catalog = await loadCatalogAdmin();
  const excluded = await loadExcludedIds(service);
  const result = await loadInterestCoverage({
    service,
    excludedOk: excluded.ok,
    excluded: excluded.ids,
  });
  const rows = result.state === "ready" ? sortInterests(result.rows, sort, dir) : [];

  return (
    <section className="ops cr-manage">
      <header className="ops-head">
        <div>
          <p className="eyebrow">Onboarding</p>
          <h1>Interests</h1>
          <p className="lede">
            Names, descriptions &amp; icons used in onboarding, filters &amp; recommendations.
            Stable IDs keep member selections when you rename or replace artwork.
          </p>
        </div>
        <a href="/admin/interests">Coverage report</a>
      </header>
      <InterestManager catalog={catalog} />
      {result.state === "unavailable" ? <p className="ops-empty">{result.reason}</p> : null}
      {result.state === "ready" && rows.length === 0 ? (
        <p className="ops-empty">No main interests are in the catalogue.</p>
      ) : null}
      {result.state === "ready" && rows.length > 0 ? (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    aria-sort={sort === column.key ? (dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <a href={columnHref(sort, dir, column.key, column.first)}>
                      {column.label}
                      {sort === column.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.members > 0 && row.behind > 0 ? "is-warn" : undefined}>
                  <td data-label="Interest">{row.title}</td>
                  <td data-label="Members">{formatCount(row.members)}</td>
                  <td data-label="Live listings">{formatCount(row.listings)}</td>
                  <td data-label="Member rank">{formatCount(row.memberRank)}</td>
                  <td data-label="Listing rank">{formatCount(row.listingRank)}</td>
                  <td data-label="Gap">{formatCount(row.behind)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
