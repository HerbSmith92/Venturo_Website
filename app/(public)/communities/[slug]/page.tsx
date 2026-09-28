import { FollowForm } from "@/components/FollowForm";
import { getCurrentUser } from "@/lib/auth";
import {
  getCommunityBySlug,
  isFollowingCommunity,
  listCommunityEventIds,
} from "@/lib/communities";
import { getEventById } from "@/lib/events";
import { notFound } from "next/navigation";

export default async function CommunityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community || community.status !== "published") notFound();
  const user = await getCurrentUser();
  const [eventIds, following] = await Promise.all([
    listCommunityEventIds(community.id),
    user ? isFollowingCommunity(user.id, community.id) : Promise.resolve(false),
  ]);
  const events = (
    await Promise.all(eventIds.map((id) => getEventById(id)))
  ).filter((event) => event && event.status === "approved");

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">
          <a href="/communities">Communities</a>
        </p>
        <h1>{community.title}</h1>
        <p className="lede muted">
          {community.placeLabel || "South Africa"}
          {community.interest ? ` · ${community.interest}` : ""}
        </p>
        {community.about ? <p style={{ whiteSpace: "pre-wrap" }}>{community.about}</p> : null}
        <div className="hero-actions" style={{ marginTop: 20 }}>
          {user ? (
            <FollowForm
              communityId={community.id}
              following={following}
              next={`/communities/${community.slug}`}
            />
          ) : (
            <a className="btn btn-primary" href={`/login?next=/communities/${community.slug}`}>
              Log In To Follow
            </a>
          )}
          {community.socialUrl ? (
            <a className="btn btn-secondary" href={community.socialUrl}>
              Social
            </a>
          ) : null}
          {community.contactEmail ? (
            <a className="btn btn-secondary" href={`mailto:${community.contactEmail}`}>
              Contact
            </a>
          ) : null}
        </div>
        <h2 style={{ marginTop: 36 }}>Events</h2>
        {events.length === 0 ? <p className="muted">No live events linked yet.</p> : null}
        <ul>
          {events.map((event) =>
            event ? (
              <li key={event.id}>
                <a href={`/events/${event.slug}`}>{event.title}</a>
              </li>
            ) : null,
          )}
        </ul>
      </section>
    </main>
  );
}

export async function generateMetadata() {
  return { title: "Community · Venturo" };
}
