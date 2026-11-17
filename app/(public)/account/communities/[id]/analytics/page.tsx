import { AnalyticsRangeFilters } from "@/components/admin/AnalyticsRangeFilters";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { getCurrentUser } from "@/lib/auth";
import { resolveAnalyticsRange } from "@/lib/analytics-range";
import { canManageCommunity, loadCommunityHostAnalytics } from "@/lib/community-host";
import { getCommunityById } from "@/lib/communities";
import { formatAnalyticsCount } from "@/lib/control-room-analytics";
import { isStaff } from "@/lib/roles";
import { notFound, redirect } from "next/navigation";

export default async function CommunityAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/communities/${id}/analytics`);
  const community = await getCommunityById(id);
  if (!community || !(await canManageCommunity(user.id, id, isStaff(user.role)))) notFound();
  const range = resolveAnalyticsRange(await searchParams);
  const stats = await loadCommunityHostAnalytics(id, community.slug, range);

  return (
    <main>
      <p className="eyebrow">Community Analytics</p>
      <h1>{community.title}</h1>
      <p className="lede muted">
        Aggregated audience activity only. Known bots &amp; staff are excluded. Website and app activity are shown separately in Africa/Johannesburg time.
      </p>
      <p><a href={`/account/communities/${id}`}>Back to community manager</a></p>
      <AnalyticsRangeFilters range={range.key} from={range.from} to={range.to} />
      <div className="cr-stats cr-stats-analytics">
        <article className="cr-stat"><span>Website views</span><strong>{formatAnalyticsCount(stats.website.views)}</strong></article>
        <article className="cr-stat"><span>Website visitors</span><strong>{formatAnalyticsCount(stats.website.visitors)}</strong></article>
        <article className="cr-stat"><span>App opens</span><strong>{formatAnalyticsCount(stats.app.views)}</strong></article>
        <article className="cr-stat"><span>App visitors</span><strong>{formatAnalyticsCount(stats.app.visitors)}</strong></article>
        <article className="cr-stat"><span>Followers</span><strong>{formatAnalyticsCount(stats.followers.total)}</strong></article>
        <article className="cr-stat"><span>Net growth</span><strong>{stats.followers.net > 0 ? "+" : ""}{formatAnalyticsCount(stats.followers.net)}</strong></article>
      </div>
      <div className="cr-analytics-charts">
        <PortalBarChart
          label="Website views"
          summary={formatAnalyticsCount(stats.website.views)}
          stat={{ label: range.label, value: formatAnalyticsCount(stats.website.visitors) + " visitors" }}
          points={stats.website.trend}
          color="var(--sapphire)"
        />
        <PortalBarChart
          label="Follower growth"
          summary={`${stats.followers.net > 0 ? "+" : ""}${formatAnalyticsCount(stats.followers.net)}`}
          stat={{ label: "Follows / unfollows", value: `${stats.followers.follows} / ${stats.followers.unfollows}` }}
          points={stats.followers.trend}
          color="var(--jade)"
        />
      </div>
    </main>
  );
}
