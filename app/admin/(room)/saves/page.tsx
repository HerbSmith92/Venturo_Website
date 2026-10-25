import { isSaveKind, loadPopularSaves, loadSavePeople, saveKindLabel, type PopularSave, type SaveKind } from "@/lib/popular-saves";
import { formatCount, formatWhen, resolveRange } from "@/lib/overview/metrics";
import { loadExcludedIds } from "@/lib/search-misses";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SaveSortKey = "title" | "kind" | "people" | "latest";
type SaveSortDir = "asc" | "desc";

const COLUMNS: { key: SaveSortKey; label: string; first: SaveSortDir }[] = [
  { key: "title", label: "Saved", first: "asc" },
  { key: "kind", label: "Kind", first: "asc" },
  { key: "people", label: "People", first: "desc" },
  { key: "latest", label: "Latest", first: "desc" },
];

function sortKey(value: string | undefined): SaveSortKey {
  return COLUMNS.some((column) => column.key === value) ? (value as SaveSortKey) : "people";
}

function sortDir(value: string | undefined, sort: SaveSortKey): SaveSortDir {
  if (value === "asc" || value === "desc") return value;
  return COLUMNS.find((column) => column.key === sort)?.first ?? "desc";
}

function sortItems(items: PopularSave[], sort: SaveSortKey, dir: SaveSortDir) {
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = sort === "kind" ? saveKindLabel(a.kind) : a[sort];
    const right = sort === "kind" ? saveKindLabel(b.kind) : b[sort];
    if (typeof left === "string" && typeof right === "string") {
      const compared = left.localeCompare(right);
      if (compared !== 0) return compared * sign;
    } else if (left !== right) {
      return ((left as number) - (right as number)) * sign;
    }
    return a.title.localeCompare(b.title);
  });
}

function contactHref(email: string, title: string) {
  const subject = "Something you saved on Venturo";
  const body = `You saved ${title} on Venturo.`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function PopularSavesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; sort?: string; dir?: string; kind?: string; target?: string }>;
}) {
  const params = await searchParams;
  const all = params.range === "all";
  const range = all ? null : resolveRange(params);
  const sort = sortKey(params.sort);
  const dir = sortDir(params.dir, sort);
  const service = createServiceClient();
  const excluded = await loadExcludedIds(service);
  const query = {
    service,
    excludedOk: excluded.ok,
    excluded: excluded.ids,
    start: range?.start ?? null,
    end: range?.end ?? null,
  };
  const focusKind: SaveKind | null = isSaveKind(params.kind) ? params.kind : null;
  const focusTarget = params.target?.trim() || null;
  const result = focusKind && focusTarget ? await loadSavePeople({ ...query, kind: focusKind, targetId: focusTarget }) : await loadPopularSaves(query);
  const items = result.state === "ready" && "items" in result ? sortItems(result.items, sort, dir) : [];

  const shared = new URLSearchParams({ range: all ? "all" : (range?.key ?? "7d") });
  if (!all && range?.key === "custom") {
    if (params.from) shared.set("from", params.from);
    if (params.to) shared.set("to", params.to);
  }
  const back = new URLSearchParams(shared);
  if (all) back.set("range", "30d");
  const history = new URLSearchParams({ range: "all" });
  const period = all ? "All current saves" : (range?.label ?? "Last 7 days");

  function columnHref(key: SaveSortKey, first: SaveSortDir) {
    const next = new URLSearchParams(shared);
    next.set("sort", key);
    next.set("dir", sort === key ? (dir === "asc" ? "desc" : "asc") : first);
    return `/admin/saves?${next.toString()}`;
  }

  return (
    <section className="ops">
      <header className="ops-head">
        <div>
          <p className="eyebrow">Control Room</p>
          <h1>Popular saves</h1>
          <p className="lede">
            {period}. A save stays on this list while the member keeps it. Saves are not split by website or app.
          </p>
        </div>
        {focusKind && focusTarget ? <a href={`/admin/saves?${shared.toString()}`}>All saves</a> : null}
        <a href={`/admin?${back.toString()}`}>Back to overview</a>
      </header>
      {result.state === "unavailable" ? <p className="ops-empty">{result.reason}</p> : null}
      {result.state === "ready" && "people" in result ? (
        <>
          <p className="ops-kicker">
            {result.href ? <a href={result.href}>{result.title}</a> : result.title}
            {" · "}
            {saveKindLabel(focusKind as SaveKind)}
            {" · "}
            {formatCount(result.people.length)} {result.people.length === 1 ? "person" : "people"}
          </p>
          {result.people.length === 0 ? <p className="ops-empty">Nobody still has this saved in this list.</p> : null}
          {result.people.length > 0 ? (
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Person</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {result.people.map((person) => (
                    <tr key={person.userId}>
                      <td data-label="When">{formatWhen(person.savedAt)}</td>
                      <td data-label="Person">{person.name}</td>
                      <td data-label="Contact">
                        {person.email ? <a href={contactHref(person.email, result.title)}>Write to them</a> : "Email unavailable"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
      {result.state === "ready" && "items" in result && items.length === 0 ? (
        <p className="ops-empty">
          No saves in this list yet. A save appears while the member keeps it.
          {all ? null : (
            <>
              {" "}
              <a href={`/admin/saves?${history.toString()}`}>All current saves</a>
            </>
          )}
        </p>
      ) : null}
      {result.state === "ready" && "items" in result && items.length > 0 ? (
        <>
          <p className="ops-kicker">
            {formatCount(result.saves)} saves · {formatCount(items.length)} different items
            {result.capped ? " · the latest 20,000 are ranked" : ""}.
            {all ? null : (
              <>
                {" "}
                <a href={`/admin/saves?${history.toString()}`}>All current saves</a>
              </>
            )}
          </p>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.key} aria-sort={sort === column.key ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                      <a href={columnHref(column.key, column.first)}>
                        {column.label}
                        {sort === column.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                      </a>
                    </th>
                  ))}
                  <th>Who</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 100).map((row) => {
                  const who = new URLSearchParams(shared);
                  who.set("kind", row.kind);
                  who.set("target", row.targetId);
                  return (
                    <tr key={`${row.kind}:${row.targetId}`}>
                      <td data-label="Saved">{row.href ? <a href={row.href}>{row.title}</a> : row.title}</td>
                      <td data-label="Kind">{saveKindLabel(row.kind)}</td>
                      <td data-label="People">{formatCount(row.people)}</td>
                      <td data-label="Latest">{formatWhen(row.latest)}</td>
                      <td data-label="Who">
                        <a href={`/admin/saves?${who.toString()}`}>Who saved it</a>
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
