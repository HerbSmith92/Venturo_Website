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
        <h1>Claim Your Listing</h1>
        <p className="lede muted">
          Find your spot, log in, & ask Control Room to verify you. Until then
          staff keep the listing — you never publish yourself.
        </p>

        <form className="field" method="get" action="/directory/claim">
          <span>Search Directory</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="e.g. Adventure Golf, Honeydew"
          />
        </form>

        {done ? <p className="notice">Claim sent. Control Room will review the evidence.</p> : null}
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
          Claim requests land in Control Room. A live listing still needs staff to publish it.
        </p>
      </section>
    </main>
  );
}
