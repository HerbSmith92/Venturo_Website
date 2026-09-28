import { saveReview } from "@/app/member-actions";
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
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const [saved, reviewResult, related] = await Promise.all([
    user ? isSaved(user.id, "listing", listing.id) : Promise.resolve(false),
    supabase
      ? supabase
          .from("listing_reviews")
          .select("id, author_name, rating, body, created_at")
          .eq("listing_id", listing.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    listPublicEvents({ limit: 12 }),
  ]);
  const reviews = (reviewResult.data ?? []) as {
    id: string;
    author_name: string;
    rating: number;
    body: string;
  }[];
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

            <div style={{ marginTop: 32 }}>
              <p className="eyebrow">Reviews</p>
              <h2>What People Said</h2>
              {reviews.length === 0 ? <p className="muted">No reviews yet.</p> : null}
              <ul className="stack-list">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <strong>
                      {review.author_name} · {review.rating}/5
                    </strong>
                    <p>{review.body}</p>
                  </li>
                ))}
              </ul>
              {user ? (
                <form action={saveReview} className="cr-panel" style={{ marginTop: 16 }}>
                  <input type="hidden" name="listing_id" value={listing.id} />
                  <input type="hidden" name="slug" value={listing.slug} />
                  <label className="field">
                    <span>Rating</span>
                    <select name="rating" defaultValue="5">
                      <option value="5">5</option>
                      <option value="4">4</option>
                      <option value="3">3</option>
                      <option value="2">2</option>
                      <option value="1">1</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Your note</span>
                    <textarea name="body" required rows={3} />
                  </label>
                  <button className="btn btn-primary" type="submit">
                    Write A Review
                  </button>
                </form>
              ) : (
                <p>
                  <a href={`/login?next=/directory/${listing.slug}`}>Log in to write a review</a>
                </p>
              )}
            </div>

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
            {listing.prices.length === 0 ? (
              <p className="muted">
                From {formatFromPrice(listing.fromPrice)}. Full price list soon.
              </p>
            ) : (
              <ul className="listing-cost-list">
                {listing.prices.map((price) => {
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
                  return (
                    <li className="listing-cost-card" key={price.id}>
                      <div>
                        <strong>{price.name}</strong>
                        {save !== null && save > 0 ? (
                          <p>Save {formatRand(save)}{suffix}</p>
                        ) : null}
                        {price.inclusions ? <p className="muted">{price.inclusions}</p> : null}
                      </div>
                      <div className="listing-cost-figures">
                        <span>
                          {price.standardPrice === 0
                            ? "Free"
                            : `${formatRand(price.standardPrice)}${suffix}`}
                          <span className="listing-cost-chevron" aria-hidden="true" />
                        </span>
                        {memberDeal ? (
                          <b>
                            {price.memberPrice === 0
                              ? "Free"
                              : `${formatRand(price.memberPrice)}${suffix}`}
                          </b>
                        ) : null}
                      </div>
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
          </aside>
        </div>
      </section>
    </main>
  );
}
