import Link from "next/link";
import {
  categoryColour,
  categoryLabel,
  formatFromPrice,
  hasMemberDiscount,
  type Listing,
} from "@/lib/listings";

export function ListingCard({
  listing,
  href = "/directory",
  showMemberPrice = false,
}: {
  listing: Listing;
  href?: string;
  showMemberPrice?: boolean;
}) {
  const discounted = hasMemberDiscount(listing);
  const colour = categoryColour(listing.category);

  return (
    <Link
      className={`card${discounted ? " card-deal" : ""}`}
      href={href}
      style={{ ["--card-accent" as string]: colour }}
    >
      <div className="card-image">
        <img src={listing.image} alt="" />
        {discounted && <span className="deal-badge">Member Discount</span>}
      </div>
      <div className="card-body">
        <p className="card-kicker" style={{ color: colour }}>
          {categoryLabel(listing.category)}
        </p>
        <h3>{listing.name}</h3>
        <p className="card-meta">
          {listing.area} · {listing.vibe}
        </p>
        <div className="price-row">
          <span className="from-price">{formatFromPrice(listing.fromPrice)}</span>
          {discounted &&
            (showMemberPrice && listing.memberFromPrice !== null ? (
              <span className="member-price">
                Members {formatFromPrice(listing.memberFromPrice)}
              </span>
            ) : (
              <span className="member-price">Paid members save</span>
            ))}
        </div>
      </div>
    </Link>
  );
}
