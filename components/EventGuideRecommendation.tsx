import Link from "next/link";
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
    <article className="guide-rec is-stack">
      <header className="guide-rec-copy">
        <p className="eyebrow">{String(index).padStart(2, "0")}</p>
        <h2>{item.title}</h2>
        {writeUp ? <p className="guide-rec-note">{writeUp}</p> : null}
      </header>
      <Link className="card guide-rec-card" href={href}>
        <div className="card-image">
          <img src={item.image} alt="" />
        </div>
        <div className="card-body">
          <h3>{item.title}</h3>
          <p className="card-meta">
            {item.when} · {item.area}
          </p>
        </div>
      </Link>
    </article>
  );
}
