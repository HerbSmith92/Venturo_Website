import type { EventGuideRecommendation } from "@/lib/event-guides";

export function EventGuideRecommendationBlock({
  item,
  index,
}: {
  item: EventGuideRecommendation;
  index: number;
}) {
  const href = `/events/${item.slug}`;
  const writeUp = item.editorialNote?.trim();

  return (
    <article className="guide-rec">
      <div className="guide-rec-photo">
        {item.image ? <img src={item.image} alt="" /> : null}
      </div>
      <div className="guide-rec-side">
        <div className="guide-rec-facts">
          <p className="eyebrow">{String(index).padStart(2, "0")}</p>
          <h2>{item.title}</h2>
          <dl className="spotlight-visit-list">
            {item.when ? (
              <>
                <dt>When</dt>
                <dd>{item.when}</dd>
              </>
            ) : null}
            {item.area ? (
              <>
                <dt>Location</dt>
                <dd>{item.area}</dd>
              </>
            ) : null}
            {item.fromPrice ? (
              <>
                <dt>Price</dt>
                <dd>{item.fromPrice}</dd>
              </>
            ) : null}
          </dl>
          <p className="spotlight-visit-note">Confirm current details before visiting.</p>
          <a className="btn btn-primary" href={href}>
            View event
          </a>
        </div>
        {writeUp ? <p className="guide-rec-note">{writeUp}</p> : null}
      </div>
    </article>
  );
}
