import { EventCard } from "@/components/EventCard";
import { getCurrentUser } from "@/lib/auth";
import {
  communityStatusLabel,
  listClaimedCommunities,
  listEventIdsByCommunity,
  listFollowedCommunities,
  type CommunityRecord,
} from "@/lib/communities";
import type { VenturoEvent } from "@/lib/event-types";
import { listEventsByIds } from "@/lib/events";
import { redirect } from "next/navigation";
import { listCommunityFollowPreferences, loadCommunityHostAnalytics } from "@/lib/community-host";
import { resolveAnalyticsRange } from "@/lib/analytics-range";
import {
  reportCommunityMessages,
  updateCommunityFollowPreferences,
} from "@/app/community-tools-actions";
import { toggleFollow } from "@/app/member-actions";

function hasEnded(event: VenturoEvent, now: number) {
  const stamp = event.endsAt || event.startsAt;
  if (!stamp) return false;
  return new Date(stamp).getTime() < now;
}

function CommunityBlock({
  community,
  href,
  kicker,
  events,
  showMemberPrice,
  preferences,
  managerStats,
}: {
  community: CommunityRecord;
  href: string;
  kicker: string;
  events: VenturoEvent[];
  showMemberPrice: boolean;
  preferences?: { hostVisible: boolean; emailEnabled: boolean; pushEnabled: boolean; muted: boolean };
  managerStats?: { views: number; followers: number };
}) {
  return (
    <article className="community-all-block">
      <a className="host-event-row" href={href}>
        {community.coverUrl ? (
          <img src={community.coverUrl} alt="" />
        ) : (
          <span className="host-event-ph" aria-hidden="true" />
        )}
        <div>
          <p className="card-kicker">{kicker}</p>
          <h2>{community.title}</h2>
          <p className="card-meta">{community.placeLabel || community.areas[0] || "South Africa"}</p>
        </div>
      </a>
      {events.length === 0 ? (
        <p className="muted">No events linked yet.</p>
      ) : (
        <div className="community-all-events">
          {events.map((event) => (
            <EventCard key={event.id} event={event} showMemberPrice={showMemberPrice} />
          ))}
        </div>
      )}
      {preferences ? (
        <details>
          <summary>Follower privacy &amp; notifications</summary>
          <form action={updateCommunityFollowPreferences} className="stack-list" style={{ marginTop: 12 }}>
            <input type="hidden" name="community_id" value={community.id} />
            <label><input type="checkbox" name="host_visible" defaultChecked={preferences.hostVisible} /> Let managers see my display name, profile photo &amp; follow date</label>
            <label><input type="checkbox" name="email_enabled" defaultChecked={preferences.emailEnabled} /> Email announcements</label>
            <label><input type="checkbox" name="push_enabled" defaultChecked={preferences.pushEnabled} /> Push announcements</label>
            <label><input type="checkbox" name="muted" defaultChecked={preferences.muted} /> Mute all general announcements</label>
            <p className="muted">Managers never receive your email, phone number or precise location.</p>
            <button className="btn btn-secondary" type="submit">Save Preferences</button>
          </form>
          <form action={reportCommunityMessages} style={{ marginTop: 16 }}>
            <input type="hidden" name="community_id" value={community.id} />
            <label className="field">
              <span>Report unwanted messages</span>
              <textarea name="reason" rows={2} required placeholder="Tell Venturo what happened." />
            </label>
            <button className="btn btn-secondary" type="submit">Send Report</button>
          </form>
          <form action={toggleFollow} style={{ marginTop: 16 }}>
            <input type="hidden" name="community_id" value={community.id} />
            <input type="hidden" name="next" value="/account/communities" />
            <button className="btn btn-secondary" type="submit">Unfollow Community</button>
          </form>
        </details>
      ) : null}
      {managerStats ? (
        <p className="muted">
          Last 7 days: {managerStats.views} website views · {managerStats.followers} current followers
        </p>
      ) : null}
    </article>
  );
}

export default async function AccountCommunitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/communities");

  const [claimed, followedAll, followPreferences] = await Promise.all([
    listClaimedCommunities(user.id),
    listFollowedCommunities(user.id),
    listCommunityFollowPreferences(user.id),
  ]);
  const ownedIds = new Set(claimed.map((community) => community.id));
  const followed = followedAll.filter((community) => !ownedIds.has(community.id));
  const eventIds = await listEventIdsByCommunity(claimed.map((community) => community.id));
  const events = await listEventsByIds([...new Set([...eventIds.values()].flat())]);
  const byId = new Map(events.map((event) => [event.id, event]));
  const now = Date.now();
  const showMemberPrice = user.plan === "paid";
  const overviewRows = await Promise.all(
    claimed.map(async (community) => [
      community.id,
      await loadCommunityHostAnalytics(
        community.id,
        community.slug,
        resolveAnalyticsRange({ range: "7d" }),
      ),
    ] as const),
  );
  const managerStats = new Map(overviewRows);

  function upcoming(communityId: string) {
    return (eventIds.get(communityId) ?? [])
      .map((id) => byId.get(id))
      .filter((event): event is VenturoEvent => Boolean(event))
      .filter((event) => event.status === "approved" && event.visibility === "public" && !hasEnded(event, now))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  return (
    <>
      <p className="eyebrow">Community</p>
      <h1>All Communities</h1>
      <p className="lede muted">The communities you have registered.</p>

      <section className="portal-create">
        <div className="colour-bar" aria-hidden="true" />
        <div className="portal-create-body">
          <div>
            <p className="eyebrow">Start Here</p>
            <h2>{claimed.length > 0 ? "Register Another Community" : "Register a Community"}</h2>
            <p className="muted">Community details, founder &amp; contact. One step at a time.</p>
          </div>
          <a className="btn btn-primary" href="/account/community">
            + New Community
          </a>
        </div>
      </section>

      {claimed.length === 0 ? (
        <p className="muted">You have not registered a community yet.</p>
      ) : (
        claimed.map((community) => (
          <CommunityBlock
            key={community.id}
            community={community}
            href={`/account/communities/${community.id}`}
            kicker={communityStatusLabel(community.status)}
            events={upcoming(community.id)}
            showMemberPrice={showMemberPrice}
            managerStats={{
              views: managerStats.get(community.id)?.website.views ?? 0,
              followers: managerStats.get(community.id)?.followers.total ?? 0,
            }}
          />
        ))
      )}

      <h2>Communities You Follow</h2>
      {followed.length === 0 ? (
        <p className="muted">
          You are not following a community yet. <a href="/communities">Browse communities</a>.
        </p>
      ) : (
        followed.map((community) => (
          <CommunityBlock
            key={community.id}
            community={community}
            href={`/communities/${community.slug}`}
            kicker="Following"
            events={upcoming(community.id)}
            showMemberPrice={showMemberPrice}
            preferences={followPreferences.get(community.id)}
          />
        ))
      )}
    </>
  );
}
