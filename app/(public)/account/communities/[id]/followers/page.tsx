import { getCurrentUser } from "@/lib/auth";
import {
  canManageCommunity,
  listVisibleCommunityFollowers,
  loadCommunityHostAnalytics,
} from "@/lib/community-host";
import { getCommunityById } from "@/lib/communities";
import { resolveAnalyticsRange } from "@/lib/analytics-range";
import { isStaff } from "@/lib/roles";
import { notFound, redirect } from "next/navigation";

export default async function CommunityFollowersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/communities/${id}/followers`);
  const community = await getCommunityById(id);
  if (!community || !(await canManageCommunity(user.id, id, isStaff(user.role)))) notFound();
  const [followers, stats] = await Promise.all([
    listVisibleCommunityFollowers(id),
    loadCommunityHostAnalytics(id, community.slug, resolveAnalyticsRange({ range: "7d" })),
  ]);

  return (
    <main>
      <p className="eyebrow">Followers</p>
      <h1>{community.title}</h1>
      <p className="lede muted">
        {stats.followers.total} total followers. Only {followers.length} {followers.length === 1 ? "person has" : "people have"} chosen to share their profile with managers.
      </p>
      <p className="muted">Private followers remain in aggregate totals. Emails, phone numbers &amp; precise locations are never shown or exported.</p>
      <p><a href={`/account/communities/${id}`}>Back to community manager</a></p>
      <div className="stack-list">
        {followers.map((follower) => (
          <article className="host-event-row" key={follower.userId}>
            {follower.avatarUrl ? <img src={follower.avatarUrl} alt="" /> : <span className="host-event-ph" aria-hidden="true" />}
            <div>
              <h2>{follower.name}</h2>
              <p className="muted">Following since {new Date(follower.followedAt).toLocaleDateString("en-ZA")}</p>
            </div>
          </article>
        ))}
        {!followers.length ? <p className="muted">No followers have opted into manager visibility yet.</p> : null}
      </div>
    </main>
  );
}
