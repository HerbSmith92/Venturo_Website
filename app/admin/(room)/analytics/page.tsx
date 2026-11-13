import { AnalyticsRangeFilters } from "@/components/admin/AnalyticsRangeFilters";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { resolveAnalyticsRange } from "@/lib/analytics-range";
import { formatAnalyticsCount, loadControlRoomAnalytics } from "@/lib/control-room-analytics";

export const dynamic = "force-dynamic";

export default async function ControlRoomAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = resolveAnalyticsRange(params);
  const stats = await loadControlRoomAnalytics(range);

  return (
    <section>
      <p className="eyebrow">Control Room</p>
      <h1>Website</h1>
      <p className="lede muted">
        Public website traffic only. Staff browsing the site is not counted.
        Visits start from the day this went live. Member-app screens sit under
        Application.
      </p>

      <div className="cr-stats cr-stats-analytics">
        <article className="cr-stat">
          <span>On Site Now</span>
          <strong>{formatAnalyticsCount(stats.onSiteNow)}</strong>
        </article>
        <article className="cr-stat">
          <span>Visits Today</span>
          <strong>{formatAnalyticsCount(stats.visitsToday)}</strong>
        </article>
        <article className="cr-stat">
          <span>Page Views Today</span>
          <strong>{formatAnalyticsCount(stats.pageviewsToday)}</strong>
        </article>
        <article className="cr-stat">
          <span>Visits 7 Days</span>
          <strong>{formatAnalyticsCount(stats.visits7d)}</strong>
        </article>
        <article className="cr-stat">
          <span>Page Views 7 Days</span>
          <strong>{formatAnalyticsCount(stats.pageviews7d)}</strong>
        </article>
      </div>

      <div className="cr-analytics-charts">
        <PortalBarChart
          label="Unique Visitors"
          summary={formatAnalyticsCount(stats.visitsToday)}
          stat={{ label: "Last 7 Days", value: formatAnalyticsCount(stats.visits7d) }}
          points={stats.visitorSeries}
          color="var(--jade)"
        />
        <PortalBarChart
          label="Page Views"
          summary={formatAnalyticsCount(stats.pageviewsToday)}
          stat={{ label: "Last 7 Days", value: formatAnalyticsCount(stats.pageviews7d) }}
          points={stats.pageviewSeries}
          color="var(--sapphire)"
        />
      </div>

      <article style={{ marginTop: 28 }}>
        <p className="eyebrow">Pages</p>
        <h2>{range.label}</h2>
        <p className="muted">
          Each public path: visits, unique visitors over this window, & average
          time stayed. Charts above stay on the last 7 days.
        </p>
        <AnalyticsRangeFilters range={range.key} from={range.from} to={range.to} />
        <div className="cr-table-wrap">
          <table className="cr-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Visits</th>
                <th>Unique visitors</th>
                <th>Average time</th>
              </tr>
            </thead>
            <tbody>
              {stats.pages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No page visits yet.
                  </td>
                </tr>
              ) : (
                stats.pages.map((row) => (
                  <tr key={row.path}>
                    <td>
                      {row.label}
                      <span className="muted"> · {row.path}</span>
                    </td>
                    <td>{formatAnalyticsCount(row.visits)}</td>
                    <td>{formatAnalyticsCount(row.visitors)}</td>
                    <td>{row.stay}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
