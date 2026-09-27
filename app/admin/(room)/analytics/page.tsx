import { AnalyticsRefreshButton } from "@/components/admin/AnalyticsRefreshButton";
import { DownloadSnapshotForm } from "@/components/admin/DownloadSnapshotForm";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import {
  androidApiConfigured,
  iosApiConfigured,
  revenueCatChartsConfigured,
} from "@/lib/analytics-remote";
import { getAppStoreLinks } from "@/lib/brand";
import {
  formatAnalyticsCount,
  formatAnalyticsMoney,
  loadControlRoomAnalytics,
} from "@/lib/control-room-analytics";
import { formatClock } from "@/lib/control-room-shared";

export const dynamic = "force-dynamic";

function sourceLabel(source: string, apiName: string) {
  if (source === "api") return apiName;
  if (source === "manual") return "Entered in Control Room";
  return "Waiting on API keys";
}

export default async function ControlRoomAnalyticsPage() {
  const stats = await loadControlRoomAnalytics();
  const stores = getAppStoreLinks();
  const rc = stats.remote.revenueCat;

  return (
    <section>
      <p className="eyebrow">Control Room</p>
      <h1>Analytics</h1>
      <p className="lede muted">
        Live public-site traffic, store downloads, accounts, RevenueCat, & paid
        members. Visits start counting from this page going live. Staff browsing
        the site is not counted.
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
          <span>iOS Downloads</span>
          <strong>{formatAnalyticsCount(stats.iosDownloads)}</strong>
        </article>
        <article className="cr-stat">
          <span>Android Downloads</span>
          <strong>{formatAnalyticsCount(stats.androidDownloads)}</strong>
        </article>
        <article className="cr-stat">
          <span>Accounts Created</span>
          <strong>{formatAnalyticsCount(stats.accounts)}</strong>
        </article>
        <article className="cr-stat">
          <span>Members</span>
          <strong>{formatAnalyticsCount(stats.members)}</strong>
        </article>
      </div>

      <p className="muted" style={{ marginTop: 16 }}>
        Last 7 days: {formatAnalyticsCount(stats.visits7d)} visits ·{" "}
        {formatAnalyticsCount(stats.pageviews7d)} page views ·{" "}
        {formatAnalyticsCount(stats.accounts7d)} new accounts. Paid members:{" "}
        {formatAnalyticsCount(stats.membersPayfast)} PayFast ·{" "}
        {formatAnalyticsCount(stats.membersApp)} App Store / Play Store.
      </p>
      <p className="muted">
        iOS: {sourceLabel(stats.iosSource, "App Store Connect")}. Android:{" "}
        {sourceLabel(stats.androidSource, "Play Console")}.
        {stats.iosError ? ` iOS note: ${stats.iosError}` : ""}
        {stats.androidError ? ` Android note: ${stats.androidError}` : ""}
      </p>

      <div className="cr-stats cr-stats-analytics" style={{ marginTop: 20 }}>
        <article className="cr-stat">
          <span>RC Active Subs</span>
          <strong>
            {rc.activeSubscriptions === null ? "—" : formatAnalyticsCount(rc.activeSubscriptions)}
          </strong>
        </article>
        <article className="cr-stat">
          <span>RC Active Trials</span>
          <strong>{rc.activeTrials === null ? "—" : formatAnalyticsCount(rc.activeTrials)}</strong>
        </article>
        <article className="cr-stat">
          <span>RC New Customers 28d</span>
          <strong>
            {rc.newCustomers28d === null ? "—" : formatAnalyticsCount(rc.newCustomers28d)}
          </strong>
        </article>
        <article className="cr-stat">
          <span>RC MRR</span>
          <strong>{formatAnalyticsMoney(rc.mrr, rc.currency ?? "USD")}</strong>
        </article>
        <article className="cr-stat">
          <span>RC Proceeds 28d</span>
          <strong>{formatAnalyticsMoney(rc.revenue28d, rc.currency ?? "USD")}</strong>
        </article>
        <article className="cr-stat">
          <span>RC Last Pull</span>
          <strong style={{ fontSize: 18 }}>
            {rc.fetchedAt ? formatClock(rc.fetchedAt) : "—"}
          </strong>
        </article>
      </div>
      <p className="muted" style={{ marginTop: 12 }}>
        RevenueCat: {sourceLabel(rc.source, "RevenueCat Charts API")}.
        {rc.error ? ` ${rc.error}` : ""}{" "}
        {revenueCatChartsConfigured()
          ? "Secret needs charts_metrics:overview:read & charts_metrics:charts:read."
          : "Set REVENUECAT_PROJECT_ID & REVENUECAT_SECRET_API_KEY on Vercel."}
      </p>

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

      <article className="cr-paper" style={{ marginTop: 28 }}>
        <p className="eyebrow">App Stores</p>
        <h2>iOS & Android Downloads</h2>
        <p className="muted">
          Automatic pulls need App Store Connect (Team API key + vendor number) &
          Play Console (Cloud Storage reports bucket + service account). Until
          those keys are on Vercel, paste totals here.
          {!stores.appStoreReady || !stores.playStoreReady
            ? " Public store buttons stay soft until listing URLs are set."
            : ""}
        </p>
        <p className="muted">
          iOS API: {iosApiConfigured() ? "Ready" : "Missing keys"}. Android API:{" "}
          {androidApiConfigured() ? "Ready" : "Missing keys"}.
        </p>
        <AnalyticsRefreshButton />
        <DownloadSnapshotForm
          iosDownloads={stats.iosDownloads}
          androidDownloads={stats.androidDownloads}
          recordedAt={stats.downloadsRecordedAt}
        />
      </article>
    </section>
  );
}
