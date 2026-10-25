import { describeSearch, loadExcludedIds, loadSearchMisses } from "@/lib/search-misses";
import { formatWhen, isPlatformFilter, platformLabel, resolveRange } from "@/lib/overview/metrics";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function platformName(value: string) {
  if (value === "web") return "Website";
  if (value === "ios") return "iOS";
  if (value === "android") return "Android";
  if (value === "unknown") return "App, platform not sent";
  return value;
}

function contactHref(email: string, search: string) {
  const subject = "A place you searched for on Venturo";
  const body = `You searched Venturo for ${search}. We have added it.`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function SearchMissesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; platform?: string; key?: string }>;
}) {
  const params = await searchParams;
  const all = params.range === "all";
  const range = all ? null : resolveRange(params);
  const platform = isPlatformFilter(params.platform) ? params.platform : "all";
  const service = createServiceClient();
  const excluded = await loadExcludedIds(service);
  const result = await loadSearchMisses({
    service,
    excludedOk: excluded.ok,
    excluded: excluded.ids,
    start: range?.start ?? null,
    end: range?.end ?? null,
    platform,
    queryKey: params.key?.trim() || null,
  });
  const back = new URLSearchParams({
    range: all ? "30d" : (range?.key ?? "7d"),
    platform,
  });
  if (!all && range?.key === "custom") {
    if (params.from) back.set("from", params.from);
    if (params.to) back.set("to", params.to);
  }
  const history = new URLSearchParams({ range: "all", platform });

  return (
    <section className="ops">
      <header className="ops-head">
        <div>
          <p className="eyebrow">Control Room</p>
          <h1>Searches with no results</h1>
          <p className="lede">
            {all ? "All kept searches" : range?.label} · {platformLabel(platform)}. A signed-in person can be contacted when that place is added.
          </p>
        </div>
        <a href={`/admin/searches?${(all ? history : back).toString()}`}>Most searched</a>
        <a href={`/admin?${back.toString()}`}>Back to overview</a>
      </header>
      {result.state === "unavailable" ? <p className="ops-empty">{result.reason}</p> : null}
      {result.state === "ready" && result.rows.length === 0 ? (
        <p className="ops-empty">Nothing in this list. An empty directory search is kept from the time it happens.</p>
      ) : null}
      {result.state === "ready" && result.rows.length > 0 ? (
        <>
          <p className="ops-kicker">
            {result.total} kept
            {result.signedIn ? ` · ${result.signedIn} signed in` : ""}
            {result.capped ? " · showing the latest 200" : ""}. Rows are not deleted.
            {all ? null : (
              <>
                {" "}
                <a href={`/admin/search-misses?${history.toString()}`}>All history</a>
              </>
            )}
          </p>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Search</th>
                  <th>Person</th>
                  <th>Platform</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => {
                  const search = describeSearch(row);
                  return (
                    <tr key={row.id}>
                      <td data-label="When">{formatWhen(row.searchedAt)}</td>
                      <td data-label="Search">{search}</td>
                      <td data-label="Person">
                        {row.userId ? row.name || "Signed-in member" : "Not signed in"}
                      </td>
                      <td data-label="Platform">{platformName(row.platform)}</td>
                      <td data-label="Contact">
                        {row.email ? (
                          <a href={contactHref(row.email, search)}>Write to them</a>
                        ) : row.userId ? (
                          "Email unavailable"
                        ) : (
                          "—"
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
