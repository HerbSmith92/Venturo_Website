import { AnalyticsRangeFilters } from "@/components/admin/AnalyticsRangeFilters";
import { resolveAnalyticsRange } from "@/lib/analytics-range";
import {
  formatAnalyticsCount,
  loadAppAnalytics,
  type ItemAnalyticsRow,
} from "@/lib/control-room-analytics";

export const dynamic = "force-dynamic";

export default async function ApplicationAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = resolveAnalyticsRange(params);
  const stats = await loadAppAnalytics(range);

  return (
    <section>
      <p className="eyebrow">Control Room</p>
      <h1>Application</h1>
      <p className="lede muted">
        Screen opens & named detail views from the member app. Staff is not
        counted. Named rows stay empty until the app posts each open with the
        item id.
      </p>
      <AnalyticsRangeFilters range={range.key} from={range.from} to={range.to} />

      <CountTable
        heading="Screen"
        eyebrow="Screens"
        title={range.label}
        empty="No screen opens yet."
        rows={stats.screens.map((row) => ({
          key: row.screen,
          name: row.label,
          hint: row.screen,
          opens: row.opens,
          visitors: row.visitors,
        }))}
      />
      <CountTable
        heading="Name"
        eyebrow="Activities"
        title={range.label}
        empty="No activity opens yet."
        rows={namedRows(stats.listings)}
      />
      <CountTable
        heading="Name"
        eyebrow="Events"
        title={range.label}
        empty="No event opens yet."
        rows={namedRows(stats.events)}
      />
      <CountTable
        heading="Name"
        eyebrow="Communities"
        title={range.label}
        empty="No community opens yet."
        rows={namedRows(stats.communities)}
      />
      <CountTable
        heading="Name"
        eyebrow="Guides"
        title={range.label}
        empty="No guide opens yet."
        rows={namedRows(stats.guides)}
      />
    </section>
  );
}

function namedRows(rows: ItemAnalyticsRow[]) {
  return rows.map((row) => ({
    key: row.id,
    name: row.name,
    hint: row.name === row.id ? row.id : undefined,
    opens: row.opens,
    visitors: row.visitors,
  }));
}

function CountTable({
  heading,
  eyebrow,
  title,
  empty,
  rows,
}: {
  heading: string;
  eyebrow: string;
  title: string;
  empty: string;
  rows: { key: string; name: string; hint?: string; opens: number; visitors: number }[];
}) {
  return (
    <article style={{ marginTop: 28 }}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>{heading}</th>
              <th>Opens</th>
              <th>Unique members</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    {row.name}
                    {row.hint && row.hint !== row.name ? (
                      <span className="muted"> · {row.hint}</span>
                    ) : null}
                  </td>
                  <td>{formatAnalyticsCount(row.opens)}</td>
                  <td>{formatAnalyticsCount(row.visitors)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
