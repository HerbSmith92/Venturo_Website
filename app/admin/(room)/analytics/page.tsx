import Link from "next/link";
import { AnalyticsRangeFilters } from "@/components/admin/AnalyticsRangeFilters";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { resolveAnalyticsRange } from "@/lib/analytics-range";
import { formatAnalyticsCount, loadControlRoomAnalytics } from "@/lib/control-room-analytics";

export const dynamic = "force-dynamic";

export default async function ControlRoomAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; traffic?: string }>;
}) {
  const params = await searchParams;
  const range = resolveAnalyticsRange(params);
  const includeExcluded = params.traffic === "all";
  const stats = await loadControlRoomAnalytics(range, includeExcluded);
  const query = new URLSearchParams({
    range: range.key,
    from: range.from,
    to: range.to,
    traffic: includeExcluded ? "audience" : "all",
  });

  return (
    <section>
      <p className="eyebrow">Control Room</p>
      <h1>Website</h1>
      <p className="lede muted">
        Public website traffic only. Audience figures exclude staff, verified bots
        & suspected bots. Member-app screens sit under Application.
      </p>
      <p>
        <Link className="button secondary" href={`/admin/analytics?${query.toString()}`}>
          {includeExcluded ? "Show filtered audience" : "Review excluded traffic"}
        </Link>
      </p>

      <div className="cr-stats cr-stats-analytics">
        <article className="cr-stat">
          <span>On Site Now</span>
          <strong>{formatAnalyticsCount(stats.onSiteNow)}</strong>
        </article>
        <article className="cr-stat">
          <span>Visitors · {range.label}</span>
          <strong>{formatAnalyticsCount(stats.visits7d)}</strong>
        </article>
        <article className="cr-stat">
          <span>Page views · {range.label}</span>
          <strong>{formatAnalyticsCount(stats.pageviews7d)}</strong>
        </article>
        <article className="cr-stat">
          <span>Pages per session</span>
          <strong>{stats.pagesPerSession ? stats.pagesPerSession.toFixed(1) : "—"}</strong>
        </article>
        <article className="cr-stat">
          <span>Active time</span>
          <strong>{stats.activeSeconds ? `${Math.round(stats.activeSeconds / 60)} min` : "—"}</strong>
        </article>
        <article className="cr-stat">
          <span>Clicks</span>
          <strong>{formatAnalyticsCount(stats.clicks)}</strong>
        </article>
        <article className="cr-stat">
          <span>RSVPs / purchases</span>
          <strong>{formatAnalyticsCount(stats.rsvps)} / {formatAnalyticsCount(stats.purchases)}</strong>
        </article>
      </div>

      <div className="cr-analytics-charts">
        <PortalBarChart
          label="Unique Visitors"
          summary={formatAnalyticsCount(stats.visits7d)}
          stat={{ label: range.label, value: formatAnalyticsCount(stats.visits7d) }}
          points={stats.visitorSeries}
          color="var(--jade)"
        />
        <PortalBarChart
          label="Page Views"
          summary={formatAnalyticsCount(stats.pageviews7d)}
          stat={{ label: range.label, value: formatAnalyticsCount(stats.pageviews7d) }}
          points={stats.pageviewSeries}
          color="var(--sapphire)"
        />
      </div>

      <article style={{ marginTop: 28 }}>
        <p className="eyebrow">Pages</p>
        <h2>{range.label}</h2>
        <p className="muted">
          Each public path: visits, unique visitors over this window, & average
          active time. Background tabs are excluded.
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

      <div className="cr-analytics-charts" style={{ marginTop: 28 }}>
        <article>
          <p className="eyebrow">Sources</p>
          <h2>Referrals & campaigns</h2>
          <div className="cr-table-wrap">
            <table className="cr-table">
              <thead><tr><th>Source</th><th>Medium / campaign</th><th>Visitors</th></tr></thead>
              <tbody>
                {stats.sources.slice(0, 20).map((row) => (
                  <tr key={`${row.source}:${row.medium}:${row.campaign}`}>
                    <td>{row.source}</td><td>{row.medium} · {row.campaign}</td>
                    <td>{formatAnalyticsCount(row.visitors)}</td>
                  </tr>
                ))}
                {!stats.sources.length && <tr><td colSpan={3} className="muted">No source data yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
        <article>
          <p className="eyebrow">Approximate location</p>
          <h2>Audience geography</h2>
          <div className="cr-table-wrap">
            <table className="cr-table">
              <thead><tr><th>Country</th><th>Region / city</th><th>Visitors</th></tr></thead>
              <tbody>
                {stats.locations.slice(0, 20).map((row) => (
                  <tr key={`${row.country}:${row.region}:${row.city}`}>
                    <td>{row.country}</td><td>{row.region} · {row.city}</td>
                    <td>{formatAnalyticsCount(row.visitors)}</td>
                  </tr>
                ))}
                {!stats.locations.length && <tr><td colSpan={3} className="muted">No location data yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article style={{ marginTop: 28 }}>
        <p className="eyebrow">Traffic quality</p>
        <h2>Classification review</h2>
        <p className="muted">
          Classification uses browser, host-verification & request-pattern signals.
          Country and VPN use never determine bot status. IP-derived diagnostics are
          rotated, never used as visitor identities & removed after 30 days.
        </p>
        <div className="cr-table-wrap">
          <table className="cr-table">
            <thead><tr><th>Class</th><th>Staff</th><th>Sessions</th></tr></thead>
            <tbody>
              {stats.trafficClasses.map((row) => (
                <tr key={`${row.traffic_class}:${row.is_staff}`}>
                  <td>{row.traffic_class.replaceAll("_", " ")}</td>
                  <td>{row.is_staff ? "Yes" : "No"}</td>
                  <td>{formatAnalyticsCount(row.sessions)}</td>
                </tr>
              ))}
              {!stats.trafficClasses.length && <tr><td colSpan={3} className="muted">Detailed classification starts after the platform analytics migration.</td></tr>}
            </tbody>
          </table>
        </div>
        {stats.classificationReasons.length > 0 && (
          <p className="muted">
            Exclusion reasons: {stats.classificationReasons.map((row) => `${row.reason.replaceAll("_", " ")} (${row.sessions})`).join(", ")}.
          </p>
        )}
        <p className="muted">
          Historical limit: detailed source, location, engagement & bot signals are
          not recoverable before this collection launched. Retained aggregates show
          47 /events views from 47 visitor cookies & 90 seconds of active time on
          16 November 2026, but no source, location or request signals. The spike
          therefore cannot be attributed conclusively without retained hosting logs.
        </p>
      </article>
    </section>
  );
}
