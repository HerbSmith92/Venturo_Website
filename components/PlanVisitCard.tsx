import {
  groupSpotlightHours,
  spotlightPriceLabel,
  type SpotlightPhoto,
  type SpotlightVisitInfo,
} from "@/lib/spotlight";

export function PlanVisitRows({ listing }: { listing: SpotlightVisitInfo }) {
  const price = spotlightPriceLabel(listing.fromPrice);
  const hourGroups = groupSpotlightHours(listing.hours);
  const suitability =
    listing.indoorOutdoor === "indoor"
      ? "Indoor"
      : listing.indoorOutdoor === "outdoor"
        ? "Outdoor"
        : listing.indoorOutdoor === "both"
          ? "Indoor & outdoor"
          : null;
  return (
    <dl className="spotlight-visit-list">
      {listing.area ? (
        <>
          <dt>Location</dt>
          <dd>{listing.area}</dd>
        </>
      ) : null}
      {price ? (
        <>
          <dt>Price</dt>
          <dd>{price}</dd>
        </>
      ) : (
        <>
          <dt>Price</dt>
          <dd>
            <a href={`/directory/${listing.slug}`}>View latest pricing</a>
          </dd>
        </>
      )}
      <dt className="spotlight-visit-hours-label">Hours</dt>
      <dd className="spotlight-visit-hours">
        {hourGroups.length ? (
          hourGroups.map((row) => (
            <div className="spotlight-visit-hour" key={`${row.days}-${row.time}`}>
              <span>{row.days}</span>
              <span className="spotlight-visit-time">{row.time}</span>
            </div>
          ))
        ) : (
          <a href={`/directory/${listing.slug}`}>Check opening times</a>
        )}
      </dd>
      {listing.bookingRequired || listing.bookingUrl ? (
        <>
          <dt>Booking</dt>
          <dd>
            {listing.bookingUrl ? (
              <a href={listing.bookingUrl} rel="noreferrer" target="_blank">
                Check availability
              </a>
            ) : (
              "Booking required"
            )}
          </dd>
        </>
      ) : null}
      {suitability ? (
        <>
          <dt>Best for</dt>
          <dd>{suitability}</dd>
        </>
      ) : null}
    </dl>
  );
}

export function PlanVisitCard({
  listing,
  photo,
  variant,
}: {
  listing: SpotlightVisitInfo;
  photo?: SpotlightPhoto | null | { url: string };
  variant: "sticky" | "end" | "mobile" | "inline";
}) {
  return (
    <aside className={`spotlight-visit is-${variant}`}>
      <p className="eyebrow">Plan your visit</p>
      {photo ? <img src={photo.url} alt="" /> : null}
      <h2>{listing.name}</h2>
      {variant === "mobile" ? listing.area ? <p className="spotlight-visit-area">{listing.area}</p> : null : <PlanVisitRows listing={listing} />}
      {variant !== "mobile" ? <p className="spotlight-visit-note">Confirm current details before visiting.</p> : null}
      <a className="btn btn-primary" href={`/directory/${listing.slug}`}>
        View activity
      </a>
    </aside>
  );
}
