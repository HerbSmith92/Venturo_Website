import { ListingCard } from "@/components/ListingCard";
import type { HomeTasteRow } from "@/lib/listings";

export function HomeDirectoryTaste({
  rows,
  showMemberPrice = false,
}: {
  rows: HomeTasteRow[];
  showMemberPrice?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="notice">
        The directory is warming up.{" "}
        <a href="/directory">Browse all listings</a> when they land.
      </p>
    );
  }

  return (
    <div className="taste-stack">
      {rows.map((row) => (
        <section key={row.id} className="taste-row" aria-labelledby={`taste-${row.id}`}>
          <div className="taste-row-head">
            <h3 id={`taste-${row.id}`}>
              <span className="taste-dot" style={{ background: row.colour }} aria-hidden />
              {row.label}
            </h3>
            <a className="btn btn-ghost" href={`/directory?category=${row.id}`}>
              See more
            </a>
          </div>
          <div className="taste-rail" role="list">
            {row.listings.map((listing) => (
              <div key={listing.id} className="taste-rail-item" role="listitem">
                <ListingCard
                  listing={listing}
                  href={`/directory/${listing.slug}`}
                  showMemberPrice={showMemberPrice}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
