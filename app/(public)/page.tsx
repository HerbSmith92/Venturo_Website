import { CategoryChips } from "@/components/CategoryChips";
import { EventCard } from "@/components/EventCard";
import { LandingBottom } from "@/components/LandingBottom";
import { ListingCard } from "@/components/ListingCard";
import { getCurrentUser } from "@/lib/auth";
import { featuredEvents } from "@/lib/events";
import { featuredListings } from "@/lib/listings";

export default async function HomePage() {
  const user = await getCurrentUser();
  const [listings, events] = await Promise.all([
    featuredListings(),
    featuredEvents(6),
  ]);

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
            <p className="eyebrow">Around Johannesburg</p>
            <h2>A Taste Of The Directory</h2>
          </div>
          <a className="btn btn-secondary" href="/directory">
            See All Listings
          </a>
        </div>
        <CategoryChips />
        <div className="grid">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              href={`/directory/${listing.slug}`}
              showMemberPrice={user?.plan === "paid"}
            />
          ))}
        </div>
      </section>

      <section className="section shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">Made For You</p>
            <h2>
              {user?.plan === "paid"
                ? `Hey ${user.firstName} — Your Next Thrill`
                : "Curated Discovery"}
            </h2>
            <p className="muted">
              {user?.plan === "paid"
                ? "Paid unlocks personal picks from your interests, persona, & energy in the app — this strip grows with you."
                : "Taste the directory free. Paid members get Made For You recommendations via the app & RevenueCat."}
            </p>
          </div>
          <a
            className="btn btn-secondary"
            href={user?.plan === "paid" ? "/directory" : "/join#paid"}
          >
            {user?.plan === "paid" ? "Open Directory" : "See Paid Membership"}
          </a>
        </div>
        <div className="grid" style={{ marginBottom: 36 }}>
          {listings.slice(0, 4).map((listing) => (
            <ListingCard
              key={`foryou-${listing.id}`}
              listing={listing}
              href={`/directory/${listing.slug}`}
              showMemberPrice={user?.plan === "paid"}
            />
          ))}
        </div>
      </section>

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
                showMemberPrice={user?.plan === "paid"}
              />
            ))}
          </div>
        )}
      </section>

      <LandingBottom />
    </main>
  );
}
