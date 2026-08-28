import { CategoryChips } from "@/components/CategoryChips";
import { ListingCard } from "@/components/ListingCard";
import { getCurrentUser } from "@/lib/auth";
import { listingsByCategory } from "@/lib/listings";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category = "all" } = await searchParams;
  const user = await getCurrentUser();
  const listings = await listingsByCategory(category);
  const paid = user?.plan === "paid";

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow" style={{ color: "var(--jade)" }}>
          Directory
        </p>
        <h1>Find Places To Go & Things To Do</h1>
        <p className="lede muted">
          {user
            ? `Hey ${user.firstName}. ${paid ? "Paid benefits are on." : "You are on Free — book events, upgrade in the app for discounts."}`
            : "Log in or sign up to save a profile. Paid members unlock curated discovery in the app."}
        </p>
        <div className="hero-actions" style={{ marginBottom: 28 }}>
          {user ? (
            <a className="btn btn-primary" href="/account">
              View Profile
            </a>
          ) : (
            <>
              <a className="btn btn-primary" href="/signup">
                Sign Up Free
              </a>
              <a className="btn btn-secondary" href="/login">
                Log In
              </a>
            </>
          )}
        </div>
        <CategoryChips active={category} />
        <div className="grid">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              href="/directory"
              showMemberPrice={paid}
            />
          ))}
        </div>
      </section>

      {!paid && (
        <section className="section gate">
          <div
            className="grid"
            style={{ filter: "blur(2px)", pointerEvents: "none" }}
          >
            {listings.slice(0, 4).map((listing) => (
              <ListingCard
                key={`locked-${listing.id}`}
                listing={listing}
                href="/join"
              />
            ))}
          </div>
          <div className="gate-overlay">
            <div>
              <h2>Curated Discovery Is For Paid Members</h2>
              <p className="lede">
                Personal recommendations & exclusive discounts unlock when
                RevenueCat confirms your App Store or Play Store subscription.
              </p>
              <a className="btn btn-primary" href="/join#paid">
                See Paid Membership
              </a>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
