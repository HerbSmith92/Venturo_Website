import { EventCard } from "@/components/EventCard";
import { ListingCard } from "@/components/ListingCard";
import { PAID_CADENCE, PAID_PRICE } from "@/lib/brand";
import type { CommunityRecord } from "@/lib/communities";
import type { VenturoEvent } from "@/lib/event-types";
import type { Listing } from "@/lib/listings";
import type { WebsiteCopy } from "@/lib/website";

const REASONS = [
  {
    src: "/brand/landing/find-your-kind-of-fun.png",
    alt: "Find your kind of fun. Your people, your interests, and your energy.",
  },
  {
    src: "/brand/landing/less-searching.jpg",
    alt: "Less searching. More exploring. A place page with prices, hours, and the map.",
  },
  {
    src: "/brand/landing/more-weekend-plans.jpg",
    alt: "More weekend plans. Events, a feed for your area, and the calendar.",
  },
] as const;

export function LandingDiscover({
  copy,
  listings,
  events,
  communities,
  appHref,
  appLabel,
  showMemberPrice = false,
}: {
  copy: WebsiteCopy;
  listings: Listing[];
  events: VenturoEvent[];
  communities: CommunityRecord[];
  appHref: string;
  appLabel: string;
  showMemberPrice?: boolean;
}) {
  return (
    <main className="landing">
      <section className="landing-hero" aria-label="Featured">
        <div className="landing-hero-media">
          <img src={copy.heroImageUrl} alt="" />
        </div>
        <div className="landing-hero-fade" aria-hidden="true" />
        <div className="shell landing-hero-stack">
          <div className="landing-hero-copy">
            <p className="eyebrow">{copy.heroEyebrow}</p>
            <h1>{copy.heroTitle}</h1>
            <p className="lede">{copy.heroLede}</p>
            <div className="hero-actions">
              <a
                className="btn btn-primary"
                href={appHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {appLabel}
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="shell landing-directory">
        <section className="landing-activities" aria-labelledby="landing-activities">
          <div className="landing-band-head">
            <div>
              <h2 id="landing-activities">Activities</h2>
              <p>Places to go & things to do, from the live directory.</p>
            </div>
            <a className="landing-see" href="/directory">
              See All
            </a>
          </div>
          {listings.length === 0 ? (
            <p className="notice">
              Activities are warming up. <a href="/directory">Browse the directory</a> when they land.
            </p>
          ) : (
            <div className="home-rail" role="list">
              {listings.map((listing) => (
                <div key={listing.id} role="listitem">
                  <ListingCard
                    listing={listing}
                    href={`/directory/${listing.slug}`}
                    showMemberPrice={showMemberPrice}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="landing-events">
          <div className="landing-band-head">
            <div>
              <h2 id="landing-events">Events</h2>
              <p>Markets, nights out & workshops near you.</p>
            </div>
            <a className="landing-see" href="/events">
              See All
            </a>
          </div>
          {events.length === 0 ? (
            <p className="notice">
              Events are warming up. <a href="/events">See what&apos;s on</a> when dates land.
            </p>
          ) : (
            <div className="home-rail" role="list">
              {events.map((event) => (
                <div key={event.id} role="listitem">
                  <EventCard event={event} showMemberPrice={showMemberPrice} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="landing-community">
          <div className="landing-band-head">
            <div>
              <h2 id="landing-community">Community</h2>
              <p>People to meet. Follow a group & it stays on your profile.</p>
            </div>
            <a className="landing-see" href="/communities">
              See All
            </a>
          </div>
          {communities.length === 0 ? (
            <p className="notice">
              Communities are warming up. <a href="/communities">Meet them here</a> when they publish.
            </p>
          ) : (
            <div className="home-rail" role="list">
              {communities.map((community) => (
                <div key={community.id} role="listitem">
                  <a
                    className="card"
                    href={`/communities/${community.slug}`}
                    style={{ ["--card-accent" as string]: "var(--blush)" }}
                  >
                    <div className="card-image" style={{ background: "var(--blush)" }}>
                      {community.coverUrl ? <img src={community.coverUrl} alt="" /> : null}
                    </div>
                    <div className="card-body">
                      <p className="card-kicker" style={{ color: "var(--blush)" }}>
                        Community
                      </p>
                      <h3>{community.title}</h3>
                      <p className="card-meta">
                        {community.placeLabel || "South Africa"}
                        {community.interest ? ` · ${community.interest}` : ""}
                      </p>
                    </div>
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="band band-light" aria-labelledby="landing-why">
        <div className="shell">
          <div className="band-intro">
            <div>
              <p className="eyebrow">The App</p>
              <h2 id="landing-why">The Phone Is Where It Gets Personal</h2>
            </div>
            <p className="lede">
              The website is the taste. The app keeps the plan in your pocket,
              shaped by your energy, your people & what pulls you in.
            </p>
          </div>
          <div className="landing-reasons">
            {REASONS.map((reason) => (
              <img key={reason.src} src={reason.src} alt={reason.alt} />
            ))}
          </div>
        </div>
      </section>

      <section className="band band-velvet" id="paid" aria-labelledby="landing-paid">
        <div className="shell membership">
          <img
            className="landing-member-shot"
            src="/brand/landing/next-adventure.jpg"
            alt="Your next adventure awaits. Discover things to do near you."
          />
          <article className="price-card">
            <p className="eyebrow">Paid Membership</p>
            <h2 id="landing-paid">Unlock The Member Price</h2>
            <p className="price-amount">{PAID_PRICE}</p>
            <p className="price-cadence">{PAID_CADENCE}</p>
            <p>
              A free profile books event tickets. Paid opens the personal feed &
              the member price, on the website with PayFast & in the app.
            </p>
            <ul>
              <li>A feed shaped by your interests, people & energy</li>
              <li>Member prices at listed spots</li>
              <li>One membership for the website & the app</li>
            </ul>
            <div className="hero-actions">
              <a
                className="btn btn-primary"
                href={appHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {appLabel}
              </a>
              <a
                className="btn btn-secondary"
                href={showMemberPrice ? "/account/membership" : "/join/subscribe"}
              >
                {showMemberPrice ? "Your Membership" : "Subscribe With PayFast"}
              </a>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
