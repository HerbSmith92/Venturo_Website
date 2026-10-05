import { EventCard } from "@/components/EventCard";
import { FollowForm } from "@/components/FollowForm";
import { ListingContact, listingContactLinks } from "@/components/ListingContact";
import { getCurrentUser } from "@/lib/auth";
import { getCommunityBySlug, isFollowingCommunity, listCommunityEventIds } from "@/lib/communities";
import { listEventsByIds } from "@/lib/events";
import type { VenturoEvent } from "@/lib/event-types";
import { notFound } from "next/navigation";

function organisationWebsite(socialUrl: string | null, websiteUrl: string | null) {
  if (websiteUrl) return websiteUrl;
  if (socialUrl && !/instagram\.com|facebook\.com|tiktok\.com/i.test(socialUrl)) return socialUrl;
  return null;
}

function hasEnded(event: VenturoEvent, now: number) {
  const stamp = event.endsAt || event.startsAt;
  if (!stamp) return false;
  return new Date(stamp).getTime() < now;
}

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
  const linked = (await listEventsByIds(eventIds)).filter(
    (event) => event.status === "approved" && event.visibility === "public",
  );
  const now = Date.now();
  const hosting = linked
    .filter((event) => !hasEnded(event, now))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const hosted = linked
    .filter((event) => hasEnded(event, now))
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const contactLinks = listingContactLinks({
    websiteUrl: organisationWebsite(community.socialUrl, community.websiteUrl),
    bookingUrl: null,
    email: community.contactEmail,
    phone: community.phone,
    social: [
      {
        platform: "instagram",
        handle: community.instagramUrl,
        url: community.instagramUrl,
      },
      {
        platform: "facebook",
        handle: community.facebookUrl,
        url: community.facebookUrl,
      },
      {
        platform: "tiktok",
        handle: community.tiktokUrl,
        url: community.tiktokUrl,
      },
    ],
  });
  const showMemberPrice = user?.plan === "paid";

  return (
    <main>
      <section className="shell">
        <div className="event-detail-hero listing-detail-hero">
          {community.coverUrl ? (
            <img src={community.coverUrl} alt="" />
          ) : (
            <div className="community-hero-fallback" />
          )}
          <div className="event-detail-hero-copy">
            <p className="eyebrow" style={{ color: "var(--blush)" }}>
              Community
              {community.interest ? ` · ${community.interest}` : ""}
            </p>
            <h1>{community.title}</h1>
            <p className="lede">{community.placeLabel || "South Africa"}</p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
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
            </div>
          </div>
        </div>
      </section>

      <section className="section shell">
        <article className="event-story">
          <p className="eyebrow">The Group</p>
          <h2>Who They Are</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {community.about || "This group is still writing their story."}
          </p>

          {community.founderName || community.founderEmail ? (
            <div className="event-venue-card">
              <p className="eyebrow">Founder</p>
              <h3>{community.founderName || "The person behind it"}</h3>
              {community.founderEmail ? (
                <p>
                  <a href={`mailto:${community.founderEmail}`}>{community.founderEmail}</a>
                </p>
              ) : (
                <p className="muted">Contact email coming soon.</p>
              )}
            </div>
          ) : null}

          <ListingContact links={contactLinks} heading="Get In Touch" />

          <div className="community-events">
            <p className="eyebrow">Coming Up</p>
            <h2>Hosting</h2>
            {hosting.length === 0 ? (
              <p className="muted">Nothing coming up yet.</p>
            ) : (
              <div className="grid community-event-grid">
                {hosting.map((event) => (
                  <EventCard key={event.id} event={event} showMemberPrice={showMemberPrice} />
                ))}
              </div>
            )}
          </div>

          <div className="community-events">
            <p className="eyebrow">Already Gathered</p>
            <h2>Hosted</h2>
            {hosted.length === 0 ? (
              <p className="muted">No past events yet.</p>
            ) : (
              <div className="grid community-event-grid">
                {hosted.map((event) => (
                  <EventCard key={event.id} event={event} showMemberPrice={showMemberPrice} />
                ))}
              </div>
            )}
          </div>

          <p style={{ marginTop: 28 }}>
            <a className="btn btn-secondary" href="/communities">
              Back To Communities
            </a>
          </p>
        </article>
      </section>
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  return { title: community ? `${community.title} · Venturo` : "Community · Venturo" };
}
