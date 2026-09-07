import { eventCategoryColour } from "@/lib/event-style";

export function EventPageHero({
  imageUrl,
  category,
  title,
  place,
  priceLabel,
  emptyHint,
  headingAs: Heading = "h1",
  className,
}: {
  imageUrl: string | null;
  category: string;
  title: string;
  place: string;
  priceLabel?: string | null;
  emptyHint?: string | null;
  headingAs?: "h1" | "h2";
  className?: string;
}) {
  const colour = eventCategoryColour(category);

  return (
    <section className={`event-detail-hero listing-detail-hero${className ? ` ${className}` : ""}`}>
      {imageUrl ? <img src={imageUrl} alt="" /> : null}
      <div className="event-detail-hero-copy">
        <p className="eyebrow" style={{ color: colour }}>
          {category}
        </p>
        <Heading>{title || "Untitled event"}</Heading>
        {place ? <p className="lede">{place}</p> : null}
        {priceLabel ? (
          <div className="price-row" style={{ marginTop: 12 }}>
            <span className="from-price">{priceLabel}</span>
          </div>
        ) : null}
        {!imageUrl && emptyHint ? <p className="muted">{emptyHint}</p> : null}
      </div>
    </section>
  );
}
