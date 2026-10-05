import { ListingCostList, type ListingCostRow } from "@/components/ListingCostList";
import { SaveForm } from "@/components/SaveForm";
import { getCurrentUser } from "@/lib/auth";
import {
  categoryColour,
  categoryLabel,
  formatFromPrice,
  getPublicListingBySlug,
} from "@/lib/listings";
import { listPublicEvents } from "@/lib/events";
import { formatDay, formatHours, formatRand } from "@/lib/control-room-shared";
import { priceUnitLabel } from "@/lib/listing-draft";
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
  const story = (listing.description || listing.shortDescription || "").trim();
  const storyKey = story.replace(/\s+/g, " ").trim().toLowerCase();
  const activities = listing.activities.flatMap((activity) => {
    const blurb = (activity.shortDescription ?? "").trim();
    const repeated =
      Boolean(blurb) &&
      Boolean(storyKey) &&
      blurb.replace(/\s+/g, " ").trim().toLowerCase() === storyKey;
    const sameName =
      activity.name.replace(/\s+/g, " ").trim().toLowerCase() ===
      listing.name.replace(/\s+/g, " ").trim().toLowerCase();
    if (repeated && sameName) return [];
    return [{ ...activity, shortDescription: repeated ? null : activity.shortDescription }];
  });
  const costRows: ListingCostRow[] = listing.prices.map((price) => {
    const memberDeal =
      price.memberPrice !== null &&
      price.standardPrice !== null &&
      price.memberPrice < price.standardPrice;
    const unit = priceUnitLabel(price.appliesTo ?? "");
    const suffix = unit ? ` ${unit}` : "";
    const save =
      memberDeal && price.standardPrice !== null && price.memberPrice !== null
        ? price.standardPrice - price.memberPrice
        : null;
    const priceLabel =
      price.standardPrice === 0 ? "Free" : `${formatRand(price.standardPrice)}${suffix}`;
    const memberLabel = memberDeal
      ? price.memberPrice === 0
        ? "Members free"
        : `Members ${formatRand(price.memberPrice)}${suffix}`
      : null;
    return {
      id: price.id,
      name: price.name,
      priceLabel,
      memberLabel,
      saveLabel: save !== null && save > 0 ? `Save ${formatRand(save)}${suffix}` : null,
      inclusions: price.inclusions,
    };
  });

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
              {listing.phone ? (
                <a className="btn btn-secondary" href={`tel:${listing.phone}`}>
                  Call
                </a>
              ) : null}
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

            {activities.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <p className="eyebrow">Activities</p>
                <h2>Things To Do Here</h2>
                <ul className="preview-ticket-list">
                  {activities.map((activity) => (
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
                        {activity.fromAmount !== null
                          ? activity.fromAmount === 0
                            ? "From Free"
                            : `From ${formatRand(activity.fromAmount)}`
                          : activity.durationMinutes
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
            {listing.prices.some(
              (price) =>
                price.memberPrice !== null &&
                price.standardPrice !== null &&
                price.memberPrice < price.standardPrice,
            ) ? (
              <p className="listing-cost-hint">
                Member prices are on.
                {!paid ? (
                  <>
                    {" "}
                    <a href="/join/subscribe">Subscribe with PayFast</a>.
                  </>
                ) : null}
              </p>
            ) : null}
            {costRows.length === 0 ? (
              <p className="muted">
                From {formatFromPrice(listing.fromPrice)}. Full price list soon.
              </p>
            ) : (
              <ListingCostList rows={costRows} />
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
          </aside>
        </div>
      </section>
    </main>
  );
}
