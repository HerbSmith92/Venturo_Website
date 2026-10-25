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
}: {
  community: CommunityRecord;
  href: string;
  kicker: string;
  events: VenturoEvent[];
  showMemberPrice: boolean;
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
    </article>
  );
}

export default async function AccountCommunitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/communities");

  const [claimed, followedAll] = await Promise.all([
    listClaimedCommunities(user.id),
    listFollowedCommunities(user.id),
  ]);
  const ownedIds = new Set(claimed.map((community) => community.id));
  const followed = followedAll.filter((community) => !ownedIds.has(community.id));
  const eventIds = await listEventIdsByCommunity(claimed.map((community) => community.id));
  const events = await listEventsByIds([...new Set([...eventIds.values()].flat())]);
  const byId = new Map(events.map((event) => [event.id, event]));
  const now = Date.now();
  const showMemberPrice = user.plan === "paid";

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
          />
        ))
      )}
    </>
  );
}
