import { EventCard } from "@/components/EventCard";
import { GuideCard } from "@/components/GuideCard";
import { ListingCard } from "@/components/ListingCard";
import { PAID_CADENCE, PAID_PRICE } from "@/lib/brand";
import type { CommunityRecord } from "@/lib/communities";
import type { VenturoEvent } from "@/lib/event-types";
import type { GuideCardData } from "@/lib/guides";
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
  guides,
  appStoreHref,
  playStoreHref,
  device,
  showMemberPrice = false,
  signedIn = false,
  firstName = "",
}: {
  copy: WebsiteCopy;
  listings: Listing[];
  events: VenturoEvent[];
  communities: CommunityRecord[];
  guides: GuideCardData[];
  appStoreHref: string;
  playStoreHref: string | null;
  device: "ios" | "android" | "desktop";
  showMemberPrice?: boolean;
  signedIn?: boolean;
  firstName?: string;
}) {
  const named = firstName.trim() && firstName.trim().toLowerCase() !== "there";
  const greeting = named ? `Hey ${firstName.trim()}` : "Your Next Adventure Awaits";

  return (
    <main className={signedIn ? "landing landing-member" : "landing"}>
      {signedIn ? (
        <section className="shell landing-welcome" aria-label="Your Venturo">
          <p className="eyebrow">Your Venturo</p>
          <h1>{greeting}</h1>
          <p className="lede">
            Activities, events, communities & guides. Pick one & get out.
          </p>
          <nav className="landing-jumps" aria-label="On this page">
            <a href="#landing-activities">Activities</a>
            <a href="#landing-events">Events</a>
            <a href="#landing-community">Communities</a>
            <a href="#landing-guides">Guides</a>
          </nav>
        </section>
      ) : (
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
              {device !== "android" ? (
                <a className="btn btn-primary" href={appStoreHref} target="_blank" rel="noopener noreferrer">
                  App Store
                </a>
              ) : null}
              {device !== "ios" && playStoreHref ? (
                <a className="btn btn-secondary" href={playStoreHref} target="_blank" rel="noopener noreferrer">
                  Google Play
                </a>
              ) : null}
              {device !== "ios" && !playStoreHref ? (
                <p className="notice">Google Play does not list the Venturo app yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      )}

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

        <section className="landing-guides" aria-labelledby="landing-guides">
          <div className="landing-band-head">
            <div>
              <h2 id="landing-guides">Guides</h2>
              <p>Hand-picked lists for weekends, rainy days & the plan in between.</p>
            </div>
            <a className="landing-see" href="/guides">
              See All
            </a>
          </div>
          {guides.length === 0 ? (
            <p className="notice">
              Guides are warming up. <a href="/guides">Read them here</a> when a list goes live.
            </p>
          ) : (
            <div className="home-rail" role="list">
              {guides.map((guide) => (
                <div key={guide.id} role="listitem">
                  <GuideCard guide={guide} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {signedIn ? null : (
      <>
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
              the member price. Subscribe on the website, or in the app.
            </p>
            <ul>
              <li>A feed shaped by your interests, people & energy</li>
              <li>Member prices at listed spots</li>
              <li>One membership for the website & the app</li>
            </ul>
            <div className="hero-actions">
              {device !== "android" ? (
                <a className="btn btn-primary" href={appStoreHref} target="_blank" rel="noopener noreferrer">
                  App Store
                </a>
              ) : null}
              {playStoreHref ? (
                <a className="btn btn-secondary" href={playStoreHref} target="_blank" rel="noopener noreferrer">
                  Google Play
                </a>
              ) : null}
              <a
                className="btn btn-secondary"
                href={showMemberPrice ? "/account/membership" : "/join/subscribe"}
              >
                {showMemberPrice ? "Your Membership" : `Subscribe · ${PAID_PRICE} / month`}
              </a>
            </div>
          </article>
        </div>
      </section>
      </>
      )}
    </main>
  );
}
