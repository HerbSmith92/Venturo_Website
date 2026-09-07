import { getCurrentUser } from "@/lib/auth";
import {
  categoryColour,
  categoryLabel,
  formatFromPrice,
  getPublicListingBySlug,
} from "@/lib/listings";
import { formatDay, formatHours, formatRand } from "@/lib/control-room-shared";
import { notFound } from "next/navigation";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getPublicListingBySlug(slug);
  if (!listing) notFound();

  const user = await getCurrentUser();
  const paid = user?.plan === "paid";
  const colour = categoryColour(listing.category);
  const address = [
    listing.streetAddress1,
    listing.streetAddress2,
    listing.area,
    listing.city,
    listing.province,
    listing.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <main>
      <section className="shell">
        <div className="event-detail-hero listing-detail-hero">
          <img src={listing.media[0]?.url ?? listing.image} alt="" />
          <div className="event-detail-hero-copy">
            <p className="eyebrow" style={{ color: colour }}>
              {categoryLabel(listing.category)}
              {listing.indoorOutdoor ? ` · ${listing.indoorOutdoor}` : ""}
            </p>
            <h1>{listing.name}</h1>
            <p className="lede">
              {listing.area}
              {listing.city && listing.city !== listing.area ? ` · ${listing.city}` : ""}
            </p>
            <div className="price-row" style={{ marginTop: 12 }}>
              <span className="from-price">{formatFromPrice(listing.fromPrice)}</span>
              {listing.memberFromPrice !== null &&
                (paid ? (
                  <span className="member-price">
                    Members from {formatFromPrice(listing.memberFromPrice)}
                  </span>
                ) : (
                  <span className="member-price">Paid members save</span>
                ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="event-detail-grid">
          <article className="event-story">
            <p className="eyebrow">The Spot</p>
            <h2>What You&apos;re Walking Into</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {listing.description || listing.shortDescription || "Details coming soon."}
            </p>

            {listing.media.length > 1 && (
              <div className="listing-gallery">
                {listing.media.slice(1, 5).map((item, index) => (
                  <img key={`${item.url}-${index}`} src={item.url} alt={item.alt ?? ""} />
                ))}
              </div>
            )}

            {listing.activities.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <p className="eyebrow">Activities</p>
                <h2>Things To Do Here</h2>
                <ul className="preview-ticket-list">
                  {listing.activities.map((activity) => (
                    <li key={activity.id}>
                      <div>
                        <strong>{activity.name}</strong>
                        {activity.shortDescription ? (
                          <p className="muted" style={{ margin: "4px 0 0" }}>
                            {activity.shortDescription}
                          </p>
                        ) : null}
                      </div>
                      <span className="muted">
                        {activity.durationMinutes
                          ? `${activity.durationMinutes} min`
                          : activity.bookingRequired
                            ? "Book ahead"
                            : "Drop in"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {address && (
              <div className="event-venue-card">
                <p className="eyebrow">Find Us</p>
                <h3>{listing.name}</h3>
                <p className="muted">{address}</p>
              </div>
            )}

            <p style={{ marginTop: 28 }}>
              <a className="btn btn-secondary" href="/directory">
                Back To Directory
              </a>
            </p>
          </article>

          <aside className="event-ticket-panel">
            <div className="colour-bar" aria-hidden="true" />
            <p className="eyebrow">Prices</p>
            <h2>What It Costs</h2>
            {!paid && listing.memberFromPrice !== null && (
              <p className="notice">
                Paid members unlock lower prices.{" "}
                <a href="/join/subscribe">Subscribe with PayFast</a>, then come
                back.
              </p>
            )}
            {listing.prices.length === 0 ? (
              <p className="muted">
                From {formatFromPrice(listing.fromPrice)}. Full price list soon.
              </p>
            ) : (
              <ul className="preview-ticket-list">
                {listing.prices.map((price) => {
                  const memberDeal =
                    price.memberPrice !== null &&
                    price.standardPrice !== null &&
                    price.memberPrice < price.standardPrice;
                  return (
                    <li key={price.id}>
                      <div>
                        <strong>{price.name}</strong>
                        {price.inclusions ? (
                          <p className="muted" style={{ margin: "4px 0 0" }}>
                            {price.inclusions}
                          </p>
                        ) : null}
                      </div>
                      <span>
                        {paid && memberDeal
                          ? formatRand(price.memberPrice)
                          : formatRand(price.standardPrice)}
                        {paid && memberDeal ? (
                          <span className="muted"> · was {formatRand(price.standardPrice)}</span>
                        ) : null}
                        {!paid && memberDeal ? (
                          <span className="muted"> · members {formatRand(price.memberPrice)}</span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {listing.hours.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <p className="eyebrow">Hours</p>
                <ul className="hours-list">
                  {listing.hours.map((row) => (
                    <li key={row.dayOfWeek}>
                      <span>{formatDay(row.dayOfWeek)}</span>
                      <span>
                        {formatHours(row.opensAt, row.closesAt, row.isClosed)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="hero-actions" style={{ marginTop: 24 }}>
              {listing.bookingUrl ? (
                <a className="btn btn-primary" href={listing.bookingUrl} target="_blank" rel="noreferrer">
                  Book / Enquire
                </a>
              ) : listing.websiteUrl ? (
                <a className="btn btn-primary" href={listing.websiteUrl} target="_blank" rel="noreferrer">
                  Visit Website
                </a>
              ) : null}
              {!paid && (
                <a className="btn btn-secondary" href="/join/subscribe">
                  Get Member Prices
                </a>
              )}
            </div>

            {(listing.phone || listing.email) && (
              <p className="muted" style={{ marginTop: 16 }}>
                {[listing.phone, listing.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
