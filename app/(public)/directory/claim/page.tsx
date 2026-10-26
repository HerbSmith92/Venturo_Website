import { ClaimRequestButton } from "@/components/ClaimRequestButton";
import { getCurrentUser } from "@/lib/auth";
import { listingsByCategory } from "@/lib/listings";

export default async function ClaimListingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; done?: string; error?: string }>;
}) {
  const { q = "", done, error } = await searchParams;
  const user = await getCurrentUser();
  const listings = await listingsByCategory("all");
  const query = q.trim().toLowerCase();
  const matches = query
    ? listings
        .filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.area.toLowerCase().includes(query) ||
            item.city.toLowerCase().includes(query),
        )
        .slice(0, 12)
    : listings.slice(0, 8);

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Businesses</p>
        <h1>Claim your listing</h1>
        <p className="lede">Help more people discover their next adventure with you.</p>
        <p>
          Claim your business listing to keep your photos, activity details, opening hours &amp; contact information up to date.
        </p>
        <p>
          Find your business below &amp; submit a claim request. Our team will verify your connection to the business before giving you access to manage its listing.
        </p>

        <form className="field" method="get" action="/directory/claim">
          <span>Find your business</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by business name"
            aria-label="Search by business name"
          />
        </form>

        {done ? (
          <p className="notice">
            Claim request sent. Our team will verify your connection to the business.
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {!user && (
          <p className="notice">
            You&apos;ll need a Free profile to start a claim.{" "}
            <a href="/login?next=/directory/claim">Log in</a> or{" "}
            <a href="/signup?next=/directory/claim">sign up</a>.
          </p>
        )}

        <div className="stack-list" style={{ marginTop: 24 }}>
          {matches.map((listing) => (
            <article key={listing.id} className="plan">
              <h3>{listing.name}</h3>
              <p className="muted">
                {listing.area} · {listing.city}
              </p>
              <div className="hero-actions" style={{ marginTop: 12 }}>
                <a className="btn btn-secondary" href={`/directory/${listing.slug}`}>
                  View Listing
                </a>
                {user ? (
                  <ClaimRequestButton
                    listingId={listing.id}
                    listingName={listing.name}
                    listingSlug={listing.slug}
                    signedIn
                  />
                ) : (
                  <a
                    className="btn btn-primary"
                    href={`/login?next=/directory/claim?q=${encodeURIComponent(listing.name)}`}
                  >
                    Log In To Claim
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 24 }}>
          Once your claim is approved, you can manage your listing. Changes are reviewed before they appear on Venturo.
        </p>
      </section>
    </main>
  );
}
