import { ListingContact, listingContactLinks } from "@/components/ListingContact";
import { ListingCostList } from "@/components/ListingCostList";
import { SaveForm } from "@/components/SaveForm";
import { getCurrentUser } from "@/lib/auth";
import {
  categoryColour,
  categoryLabel,
  formatFromPrice,
  getPublicListingBySlug,
} from "@/lib/listings";
import { listPublicEvents } from "@/lib/events";
import { formatDay, formatHours } from "@/lib/control-room-shared";
import { buildListingCostGroups, presentListingCosts } from "@/lib/listing-costs";
import { isSaved } from "@/lib/saves";
import { notFound } from "next/navigation";

function googleReviewsHref(listing: { name: string; area: string; mapsUrl: string | null }) {
  const maps = listing.mapsUrl ?? "";
  if (/\/maps\/place\/|place_id=|cid=/.test(maps)) return maps;
  const query = [listing.name, listing.area].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="cr-phone-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => {
        const state = rating >= star ? "filled" : rating >= star - 0.5 ? "half" : undefined;
        return (
          <span key={star} className={state}>
            ★
          </span>
        );
      })}
    </span>
  );
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ offer?: string }>;
}) {
  const { slug } = await params;
  const { offer } = await searchParams;
  const listing = await getPublicListingBySlug(slug);
  if (!listing) notFound();

  const user = await getCurrentUser();
  const paid = user?.plan === "paid";
  const [saved, related] = await Promise.all([
    user ? isSaved(user.id, "listing", listing.id) : Promise.resolve(false),
    listPublicEvents({ limit: 12 }),
  ]);
  const relatedEvents = related.filter(
    (event) => listing.city && event.city && event.city.toLowerCase() === listing.city.toLowerCase(),
  ).slice(0, 3);
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
  const costGroups = presentListingCosts(buildListingCostGroups(listing), paid);
  const memberLocked = costGroups.some((group) => group.items.some((item) => item.memberLocked));
  const contactLinks = listingContactLinks(listing);

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
            {listing.googleRating != null ? (
              <p className="listing-google-rating">
                <ReviewStars rating={listing.googleRating} />
                <span>
                  {listing.googleRating.toFixed(1)}
                  {listing.googleReviewCount
                    ? ` · ${listing.googleReviewCount.toLocaleString("en-ZA")} Google reviews`
                    : " · Google"}
                </span>
              </p>
            ) : null}
            <div className="price-row" style={{ marginTop: 12 }}>
              {listing.fromPrice != null ? (
                <span className="from-price">{formatFromPrice(listing.fromPrice)}</span>
              ) : null}
              {listing.memberFromPrice !== null &&
                (paid ? (
                  <span className="member-price">
                    Members from {formatFromPrice(listing.memberFromPrice)}
                  </span>
                ) : (
                  <span className="member-price">Members save 15%</span>
                ))}
            </div>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <SaveForm
                kind="listing"
                targetId={listing.id}
                saved={saved}
                next={`/directory/${listing.slug}`}
              />
              <a className="btn btn-secondary" href={`/directory/claim?q=${encodeURIComponent(listing.name)}`}>
                Claim Listing
              </a>
              {listing.mapsUrl ? (
                <a className="btn btn-secondary" href={listing.mapsUrl}>
                  Get Directions
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {offer === "member" ? (
        <p className="notice shell">Open the Venturo app to claim this member price.</p>
      ) : null}

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

            {address && (
              <div className="event-venue-card">
                <p className="eyebrow">Find Us</p>
                <h3>{listing.name}</h3>
                <p className="muted">{address}</p>
              </div>
            )}

            <ListingContact links={contactLinks} />

            <div className="listing-reviews">
              <p className="eyebrow">Reviews</p>
              <h2>On Google</h2>
              {listing.googleRating != null ? (
                <p className="listing-google-rating">
                  <ReviewStars rating={listing.googleRating} />
                  <span>
                    Avg {listing.googleRating.toFixed(1)}
                    {listing.googleReviewCount
                      ? ` from ${listing.googleReviewCount.toLocaleString("en-ZA")} Google reviews.`
                      : " on Google."}
                  </span>
                </p>
              ) : (
                <p className="muted">This place&apos;s reviews live on Google.</p>
              )}
              <p style={{ marginTop: 16 }}>
                <a
                  className="btn btn-secondary"
                  href={googleReviewsHref(listing)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read Them On Google
                </a>
              </p>
            </div>

            <p style={{ marginTop: 28 }}>
              <a className="btn btn-secondary" href="/directory">
                Back To Directory
              </a>
            </p>

            {relatedEvents.length > 0 ? (
              <div style={{ marginTop: 32 }}>
                <p className="eyebrow">Nearby</p>
                <h2>Related Events</h2>
                <ul>
                  {relatedEvents.map((event) => (
                    <li key={event.id}>
                      <a href={`/events/${event.slug}`}>{event.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>

          <aside className="event-ticket-panel">
            <div className="colour-bar" aria-hidden="true" />
            <p className="eyebrow">Prices</p>
            <h2>What It Costs</h2>
            {memberLocked ? (
              <p className="listing-cost-member-note">Members save 15%. Join to claim it.</p>
            ) : null}
            {costGroups.length === 0 ? (
              <p className="muted">
                {listing.fromPrice != null
                  ? `From ${formatFromPrice(listing.fromPrice)}. Full price list soon.`
                  : "Price to follow."}
              </p>
            ) : (
              <ListingCostList groups={costGroups} />
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

            {!paid && (
              <div className="hero-actions" style={{ marginTop: 24 }}>
                <a className="btn btn-secondary" href="/join/subscribe">
                  Get Member Prices
                </a>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
