import { EventPageHero } from "@/components/events/EventPageHero";
import { eventCategoryColour } from "@/lib/event-style";
import { formatCents, formatEventFromPrice, parseRandsToCents } from "@/lib/event-types";

export type ReviewTicket = {
  id?: string;
  name: string;
  description: string;
  kind: string;
  priceRands: string;
  quantity: string;
};

export function EventReviewPreview({
  title,
  description,
  category,
  tags,
  ageRestriction,
  whenLabel,
  repeatLabel,
  venueName,
  address,
  city,
  bannerUrl,
  listingImageUrl,
  tickets,
}: {
  title: string;
  description: string;
  category: string;
  tags: string[];
  ageRestriction: string;
  whenLabel: string;
  repeatLabel: string;
  venueName: string;
  address: string;
  city: string;
  bannerUrl: string;
  listingImageUrl: string;
  tickets: ReviewTicket[];
}) {
  const place = [venueName, city].filter((part) => part.trim()).join(" · ");
  const priced = tickets
    .filter((ticket) => ticket.kind === "paid")
    .map((ticket) => parseRandsToCents(ticket.priceRands));
  const fromCents = tickets.length
    ? tickets.every((ticket) => ticket.kind === "free")
      ? 0
      : priced.length
        ? Math.min(...priced)
        : null
    : null;
  const priceLabel = formatEventFromPrice(fromCents);
  const colour = eventCategoryColour(category);
  const heading = title.trim() || "Untitled event";

  return (
    <div className="event-review-pair">
      <section className="event-review-site" aria-label="Website">
        <p className="eyebrow">Website</p>
        <EventPageHero
          className="event-review-hero"
          headingAs="h2"
          imageUrl={bannerUrl || null}
          category={category || "Adventure & Thrills"}
          title={heading}
          place={place}
          priceLabel={priceLabel}
          emptyHint="Event page picture still needed."
        />
        <div className="event-live-bar">
          <div className="event-live-bar-item">
            <span className="eyebrow">When</span>
            <strong>{whenLabel || "Date coming"}</strong>
            {repeatLabel ? <p className="muted">{repeatLabel}</p> : null}
          </div>
          <div className="event-live-bar-item">
            <span className="eyebrow">Where</span>
            <strong>{place || "Venue coming"}</strong>
          </div>
          <span className="btn btn-secondary">Save</span>
        </div>
        <div className="event-detail-grid">
          <article className="event-story">
            <div className="event-live-block">
              <p className="eyebrow">Details</p>
              <h2>What You&apos;re Walking Into</h2>
              {tags.length > 0 ? (
                <div className="chips tag-list">
                  {tags.map((tag) => (
                    <span className="chip chip-light" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <p style={{ whiteSpace: "pre-wrap" }}>{description.trim() || "Details coming soon."}</p>
            </div>
            <div className="event-live-block">
              <p className="eyebrow">Information</p>
              <dl className="event-info-list">
                <div>
                  <dt>Age Requirement</dt>
                  <dd>{ageRestriction || "All ages"}</dd>
                </div>
              </dl>
            </div>
            {venueName.trim() || address.trim() ? (
              <div className="event-venue-card">
                <p className="eyebrow">Meet Here</p>
                <h3>{venueName.trim() || "Venue coming"}</h3>
                {address.trim() ? <p className="muted">{address}</p> : null}
              </div>
            ) : null}
          </article>
          <aside className="event-ticket-panel">
            <div className="colour-bar" aria-hidden="true" />
            <p className="eyebrow">Tickets</p>
            <h2>Claim Your Spot</h2>
            {tickets.length === 0 ? (
              <p className="muted">Coming soon.</p>
            ) : (
              <div className="ticket-picker">
                {tickets.map((ticket, index) => (
                  <div className="ticket-row" key={ticket.id ?? `${ticket.name}-${index}`}>
                    <div>
                      <strong>{ticket.name.trim() || "Ticket"}</strong>
                      {ticket.description.trim() ? (
                        <p className="muted" style={{ margin: "4px 0 0" }}>
                          {ticket.description}
                        </p>
                      ) : null}
                      <p className="muted" style={{ margin: "4px 0 0" }}>
                        {ticket.kind === "free"
                          ? "Free"
                          : formatCents(parseRandsToCents(ticket.priceRands))}
                        {" · "}
                        {ticket.quantity || "0"} left
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="event-review-app" aria-label="App">
        <p className="eyebrow">App</p>
        <div className="event-review-phone">
          <article className="event-review-app-card">
            {listingImageUrl ? (
              <img src={listingImageUrl} alt="" />
            ) : (
              <p className="event-review-app-empty">Feed post still needed.</p>
            )}
            <div className="event-review-app-copy">
              <span className="event-review-app-accent" style={{ background: colour }} />
              <p>{category || "Adventure & Thrills"}</p>
              <h3>{heading}</h3>
              <p>{[city.trim(), whenLabel, priceLabel].filter(Boolean).join(" · ")}</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
