import { CategoryChips } from "@/components/CategoryChips";
import { EventCard } from "@/components/EventCard";
import { GuideCard } from "@/components/GuideCard";
import { HomeDirectoryTaste } from "@/components/HomeDirectoryTaste";
import { LandingBottom } from "@/components/LandingBottom";
import { ListingCard } from "@/components/ListingCard";
import { getCurrentUser } from "@/lib/auth";
import { PAID_PRICE } from "@/lib/brand";
import { featuredEvents } from "@/lib/events";
import { liveGuides } from "@/lib/guides";
import { homeTasteRows } from "@/lib/listings";
import { madeForYouListings } from "@/lib/recommendations";

export default async function HomePage() {
  const user = await getCurrentUser();
  const paid = user?.plan === "paid";
  const [tasteRows, events, forYou, guides] = await Promise.all([
    homeTasteRows(10, 3),
    featuredEvents(6),
    madeForYouListings({
      userId: user?.id ?? null,
      paid,
      limit: 4,
    }),
    liveGuides(3),
  ]);

  const aroundLabel = forYou.placeName
    ? `Around ${forYou.placeName}`
    : "Around South Africa";

  return (
    <main>
      <section className="shell">
        <a className="hero" href="/directory">
          <img src="/brand/images/hero-family-van.jpg" alt="" />
          <div className="hero-copy">
            <p className="eyebrow">Activities · Events · Community</p>
            <h1>Your Next Adventure Awaits</h1>
            <p className="lede">
              A taste of the Venturo directory — places to go, people to meet,
              & quality time worth keeping.
            </p>
            <div className="hero-actions">
              <span className="btn btn-primary">Open The Directory</span>
              <span className="btn btn-secondary">Explore, Connect, Thrive</span>
            </div>
          </div>
        </a>
      </section>

      <section className="section shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">{aroundLabel}</p>
            <h2>A Taste Of The Directory</h2>
          </div>
          <a className="btn btn-secondary" href="/directory">
            See All Listings
          </a>
        </div>
        <CategoryChips />
        <HomeDirectoryTaste rows={tasteRows} showMemberPrice={paid} />
      </section>

      <section className="section shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">Made For You</p>
            <h2>
              {paid
                ? `Hey ${user?.firstName} — Your Next Thrill`
                : "Curated Discovery"}
            </h2>
            <p className="muted">
              {paid && forYou.mode === "personalised"
                ? forYou.placeName
                  ? `Picked from your interests, how you go out, activity level, & spots near ${forYou.placeName}.`
                  : "Picked from your interests, how you go out, & activity level."
                : paid
                  ? "Finish a few more profile bits to unlock sharper picks — or browse the directory now."
                  : "Taste the directory free. Paid members get Made For You picks from their profile."}
            </p>
          </div>
          <a
            className="btn btn-secondary"
            href={paid ? "/directory" : user ? "/join/subscribe" : "/join"}
          >
            {paid ? "Open Directory" : "Upgrade Your Experience"}
          </a>
        </div>
        <div className="grid" style={{ marginBottom: 36 }}>
          {forYou.listings.map((listing) => (
            <ListingCard
              key={`foryou-${listing.id}`}
              listing={listing}
              href={`/directory/${listing.slug}`}
              showMemberPrice={paid}
            />
          ))}
        </div>
        {!paid && (
          <p className="notice">
            These are Top Picks for a taste. From as little as {PAID_PRICE} per
            month, explore more —{" "}
            <a href={user ? "/join/subscribe" : "/join"}>Upgrade Your Experience</a>.
          </p>
        )}
      </section>

      {guides.length > 0 && (
        <section className="section shell">
          <div className="section-head">
            <div>
              <p className="eyebrow">Lists Worth Keeping</p>
              <h2>Guides</h2>
            </div>
            <a className="btn btn-secondary" href="/guides">
              See All Guides
            </a>
          </div>
          <div className="guide-grid">
            {guides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </section>
      )}

      <section className="section shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">Find Your Next Thrill</p>
            <h2>What&apos;s On</h2>
          </div>
          <a className="btn btn-secondary" href="/events">
            See All Adventures
          </a>
        </div>
        {events.length === 0 ? (
          <p className="notice">
            The calendar is warming up.{" "}
            <a href={user ? "/events/create" : "/login?next=/events/create"}>
              Host an adventure
            </a>{" "}
            — member hosts get a quick Control Room yes first.
          </p>
        ) : (
          <div className="grid">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                showMemberPrice={paid}
              />
            ))}
          </div>
        )}
      </section>

      <LandingBottom />
    </main>
  );
}
