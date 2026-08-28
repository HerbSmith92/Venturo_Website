import { CategoryChips } from "@/components/CategoryChips";
import { LandingBottom } from "@/components/LandingBottom";
import { ListingCard } from "@/components/ListingCard";
import { getCurrentUser } from "@/lib/auth";
import { featuredListings } from "@/lib/listings";

export default async function HomePage() {
  const user = await getCurrentUser();
  const listings = await featuredListings();

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
              href="/directory"
              showMemberPrice={user?.plan === "paid"}
            />
          ))}
        </div>
      </section>

      <LandingBottom />
    </main>
  );
}
