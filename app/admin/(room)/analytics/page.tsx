import { AnalyticsKeysGuide } from "@/components/admin/AnalyticsKeysGuide";
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

function sourceLabel(source: string, apiName: string, error?: string | null) {
  if (source === "api") return apiName;
  if (source === "manual") return "Entered in Control Room";
  if (error) return "Keys need a fix";
  return "Waiting on API keys";
}

function friendlyError(error: string | null) {
  if (!error) return "";
  if (/legacy API key/i.test(error)) {
    return " Needs a new Secret API key (v2), not the public/legacy SDK key.";
  }
  return ` ${error}`;
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
        Website and app share these counts. Listings, tickets, and memberships are the published
        records, not a second database.
      </p>
      <p className="lede muted">
        Live public-site traffic, daily store downloads, accounts, RevenueCat, &
        paid members. Visits start counting from this page going live. Staff
        browsing the site is not counted. Apple & Play reports often lag 1–2
        days, so Today can sit at 0 until the store files land.
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
          <span>iOS Today</span>
          <strong>{formatAnalyticsCount(stats.iosToday)}</strong>
        </article>
        <article className="cr-stat">
          <span>Android Today</span>
          <strong>{formatAnalyticsCount(stats.androidToday)}</strong>
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
        {formatAnalyticsCount(stats.accounts7d)} new accounts ·{" "}
        {formatAnalyticsCount(stats.ios7d)} iOS downloads ·{" "}
        {formatAnalyticsCount(stats.android7d)} Android downloads. Paid members:{" "}
        {formatAnalyticsCount(stats.membersPayfast)} PayFast ·{" "}
        {formatAnalyticsCount(stats.membersApp)} App Store / Play Store.
      </p>
      <p className="muted">
        Lifetime: {formatAnalyticsCount(stats.iosDownloads)} iOS ·{" "}
        {formatAnalyticsCount(stats.androidDownloads)} Android. iOS:{" "}
        {sourceLabel(stats.iosSource, "App Store Connect", stats.iosError)}. Android:{" "}
        {sourceLabel(stats.androidSource, "Play Console", stats.androidError)}.
        {stats.iosError ? ` iOS note:${friendlyError(stats.iosError)}` : ""}
        {stats.androidError ? ` Android note:${friendlyError(stats.androidError)}` : ""}
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
        RevenueCat: {sourceLabel(rc.source, "RevenueCat Charts API", rc.error)}.
        {rc.error ? friendlyError(rc.error) : ""}{" "}
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
        <PortalBarChart
          label="iOS Downloads"
          summary={formatAnalyticsCount(stats.iosToday)}
          stat={{ label: "Last 7 Days", value: formatAnalyticsCount(stats.ios7d) }}
          points={stats.iosSeries}
          color="var(--jade)"
        />
        <PortalBarChart
          label="Android Downloads"
          summary={formatAnalyticsCount(stats.androidToday)}
          stat={{ label: "Last 7 Days", value: formatAnalyticsCount(stats.android7d) }}
          points={stats.androidSeries}
          color="var(--sapphire)"
        />
      </div>

      <article className="cr-paper" style={{ marginTop: 28 }}>
        <p className="eyebrow">App Stores</p>
        <h2>iOS & Android Downloads</h2>
        <p className="muted">
          Daily bars come from App Store Connect (first-time downloads) & Play
          Console (daily user installs). Lifetime totals sit above. Create the
          keys in Settings, then paste them on Vercel Production. Until then,
          paste lifetime totals here.
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

      <AnalyticsKeysGuide />
    </section>
  );
}
