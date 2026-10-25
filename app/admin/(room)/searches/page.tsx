import { describeSearch, loadExcludedIds, loadPopularSearches } from "@/lib/search-misses";
import { formatCount, isPlatformFilter, platformLabel, resolveRange } from "@/lib/overview/metrics";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PopularSearchesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; platform?: string }>;
}) {
  const params = await searchParams;
  const all = params.range === "all";
  const range = all ? null : resolveRange(params);
  const platform = isPlatformFilter(params.platform) ? params.platform : "all";
  const service = createServiceClient();
  const excluded = await loadExcludedIds(service);
  const result = await loadPopularSearches({
    service,
    excludedOk: excluded.ok,
    excluded: excluded.ids,
    start: range?.start ?? null,
    end: range?.end ?? null,
    platform,
  });
  const shared = new URLSearchParams({
    range: all ? "all" : (range?.key ?? "7d"),
    platform,
  });
  if (!all && range?.key === "custom") {
    if (params.from) shared.set("from", params.from);
    if (params.to) shared.set("to", params.to);
  }
  const back = new URLSearchParams(shared);
  if (all) back.set("range", "30d");
  const history = new URLSearchParams({ range: "all", platform });

  return (
    <section className="ops">
      <header className="ops-head">
        <div>
          <p className="eyebrow">Control Room</p>
          <h1>Most searched</h1>
          <p className="lede">
            {all ? "All kept searches" : range?.label} · {platformLabel(platform)}. A person counts once a day for the same search.
          </p>
        </div>
        <a href={`/admin/search-misses?${shared.toString()}`}>Searches with no results</a>
        <a href={`/admin?${back.toString()}`}>Back to overview</a>
      </header>
      {result.state === "unavailable" ? <p className="ops-empty">{result.reason}</p> : null}
      {result.state === "ready" && result.terms.length === 0 ? (
        <p className="ops-empty">No directory searches in this list yet. A keyword, place, category, price, or Near me is kept from the time it happens.</p>
      ) : null}
      {result.state === "ready" && result.terms.length > 0 ? (
        <>
          <p className="ops-kicker">
            {formatCount(result.searches)} searches · {formatCount(result.terms.length)} different searches
            {result.capped ? " · the latest 20,000 are ranked" : ""}. Rows are not deleted.
            {all ? null : (
              <>
                {" "}
                <a href={`/admin/searches?${history.toString()}`}>All history</a>
              </>
            )}
          </p>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Search</th>
                  <th>Times</th>
                  <th>Signed in</th>
                  <th>No results</th>
                </tr>
              </thead>
              <tbody>
                {result.terms.slice(0, 100).map((row) => {
                  const who = new URLSearchParams(shared);
                  who.set("key", row.queryKey);
                  return (
                    <tr key={row.queryKey}>
                      <td data-label="Search">{describeSearch(row)}</td>
                      <td data-label="Times">{formatCount(row.times)}</td>
                      <td data-label="Signed in">{formatCount(row.people)}</td>
                      <td data-label="No results">
                        {row.empty > 0 ? (
                          <a href={`/admin/search-misses?${who.toString()}`}>{formatCount(row.empty)}</a>
                        ) : (
                          "0"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
