import Link from "next/link";
import type { EventGuideRecommendation } from "@/lib/event-guides";

export function EventGuideRecommendationBlock({
  item,
  index,
}: {
  item: EventGuideRecommendation;
  index: number;
}) {
  const flipped = index % 2 === 0;
  const href = `/events/${item.slug}`;

  const card = (
    <Link className="card guide-rec-card" href={href}>
      <div className="card-image">
        <img src={item.image} alt="" />
        <span className="guide-rec-num">{index}</span>
      </div>
      <div className="card-body">
        <p className="card-kicker">Event</p>
        <h3>{item.title}</h3>
        <p className="card-meta">{item.when}</p>
        <p className="card-meta">{item.area}</p>
        {item.fromPrice ? (
          <div className="price-row">
            <span className="from-price">{item.fromPrice}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );

  const copy = (
    <div className="guide-rec-copy">
      <p className="eyebrow">Spot {index}</p>
      <h2>{item.title}</h2>
      <p className="muted">
        {item.when} · {item.area}
      </p>
      {item.editorialNote ? <p className="guide-rec-note">{item.editorialNote}</p> : null}
      <a className="btn btn-primary guide-see-more" href={href}>
        See More <span aria-hidden="true">→</span>
      </a>
    </div>
  );

  return (
    <article className={flipped ? "guide-rec guide-rec-flip" : "guide-rec"}>
      {card}
      {copy}
    </article>
  );
}
