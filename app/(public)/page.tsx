import { EventCard } from "@/components/EventCard";
import { GuideCard } from "@/components/GuideCard";
import { LandingBottom } from "@/components/LandingBottom";
import { ListingCard } from "@/components/ListingCard";
import { getCurrentUser } from "@/lib/auth";
import { PAID_PRICE } from "@/lib/brand";
import { madeForYouListings } from "@/lib/recommendations";
import { loadHomeFeatures, loadWebsiteCopy } from "@/lib/website";

export default async function HomePage() {
  const user = await getCurrentUser();
  const paid = user?.plan === "paid";
  const [copy, features, forYou] = await Promise.all([
    loadWebsiteCopy(),
    loadHomeFeatures(),
    madeForYouListings({
      userId: user?.id ?? null,
      paid,
      limit: 4,
    }),
  ]);

  return (
    <main>
      <section className="shell">
        <div className="hero">
          <img src={copy.heroImageUrl} alt="" />
          <div className="hero-copy">
            <p className="eyebrow">{copy.heroEyebrow}</p>
            <h1>{copy.heroTitle}</h1>
            <p className="lede">{copy.heroLede}</p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="/directory">
                Open The Directory
              </a>
              <a className="btn btn-secondary" href="/events">
                See What&apos;s On
              </a>
            </div>
          </div>
        </div>
        <form className="cr-filters" action="/directory" style={{ marginTop: 18 }}>
          <input name="q" type="search" placeholder="Search activities" aria-label="Search activities" />
          <input name="place" type="search" placeholder="Place, e.g. Sandton" aria-label="Place" />
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </form>
      </section>

      <section className="section shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">What&apos;s On</p>
            <h2>Featured Events</h2>
          </div>
          <a className="btn btn-secondary" href="/events">
            See All Adventures
          </a>
        </div>
        {features.events.length === 0 ? (
          <p className="notice">
            The calendar is warming up. <a href="/event-host">Host on Venturo</a>.
          </p>
        ) : (
          <div className="home-rail">
            {features.events.map((event) => (
              <EventCard key={event.id} event={event} showMemberPrice={paid} />
            ))}
          </div>
        )}
      </section>

      <section className="section shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>Featured Activities</h2>
          </div>
          <a className="btn btn-secondary" href="/directory">
            See All Listings
          </a>
        </div>
        <div className="home-rail">
          {features.listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              href={`/directory/${listing.slug}`}
              showMemberPrice={paid}
            />
          ))}
        </div>
        {paid && forYou.listings.length > 0 ? (
          <div style={{ marginTop: 36 }}>
            <p className="eyebrow">For You</p>
            <h2>Hey {user?.firstName}</h2>
            <div className="grid" style={{ marginTop: 16 }}>
              {forYou.listings.map((listing) => (
                <ListingCard
                  key={`foryou-${listing.id}`}
                  listing={listing}
                  href={`/directory/${listing.slug}`}
                  showMemberPrice
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="section shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">People First</p>
            <h2>Featured Communities</h2>
          </div>
          <a className="btn btn-secondary" href="/communities">
            See Communities
          </a>
        </div>
        {features.communities.length === 0 ? (
          <p className="muted">Communities appear here once Control Room publishes them.</p>
        ) : (
          <div className="home-rail">
            {features.communities.map((community) => (
              <a key={community.id} className="card" href={`/communities/${community.slug}`}>
                <div className="card-body">
                  <p className="card-kicker">Community</p>
                  <h3>{community.title}</h3>
                  <p className="card-meta">
                    {community.placeLabel || "South Africa"}
                    {community.interest ? ` · ${community.interest}` : ""}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {features.guides.length > 0 && (
        <section className="section shell">
          <div className="section-head">
            <div>
              <p className="eyebrow">Lists Worth Keeping</p>
              <h2>Latest Guides</h2>
            </div>
            <a className="btn btn-secondary" href="/guides">
              See All Guides
            </a>
          </div>
          <div className="home-rail">
            {features.guides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </section>
      )}

      <section className="section shell">
        <p className="eyebrow">Membership</p>
        <h2>Free To Taste. Paid To Go Deeper.</h2>
        <p className="lede">
          A free profile books event tickets. From {PAID_PRICE} a month, Made For You and member
          prices unlock on the website and in the app. Same account either way.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href={user ? "/join/subscribe" : "/join"}>
            {paid ? "Manage Membership" : "See Membership"}
          </a>
          <a className="btn btn-secondary" href="/account">
            My Venturo
          </a>
        </div>
      </section>

      <LandingBottom />
    </main>
  );
}
