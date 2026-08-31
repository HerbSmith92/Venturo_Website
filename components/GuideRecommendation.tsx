import Link from "next/link";
import {
  categoryColour,
  categoryLabel,
  formatFromPrice,
  type GuideRecommendation,
} from "@/lib/guides";

export function GuideRecommendationBlock({
  item,
  index,
  paid,
}: {
  item: GuideRecommendation;
  index: number;
  paid: boolean;
}) {
  const memberDeal = item.memberFromPrice !== null;
  const colour = categoryColour(item.category);
  const flipped = index % 2 === 0;
  const href = `/directory/${item.slug}`;

  const card = (
    <Link
      className={`card guide-rec-card${memberDeal ? " card-deal" : ""}`}
      href={href}
      style={{ ["--card-accent" as string]: colour }}
    >
      <div className="card-image">
        <img src={item.image} alt="" />
        <span className="guide-rec-num">{index}</span>
        {memberDeal && <span className="deal-badge">Member Discount</span>}
      </div>
      <div className="card-body">
        <p className="card-kicker" style={{ color: colour }}>
          {categoryLabel(item.category)}
        </p>
        <h3>{item.name}</h3>
        <p className="card-meta">{item.area}</p>
        <div className="price-row">
          <span className="from-price">{formatFromPrice(item.fromPrice)}</span>
          {memberDeal &&
            (paid && item.memberFromPrice !== null ? (
              <span className="member-price">
                Members {formatFromPrice(item.memberFromPrice)}
              </span>
            ) : (
              <span className="member-price">Paid members save</span>
            ))}
        </div>
      </div>
    </Link>
  );

  const copy = (
    <div className="guide-rec-copy">
      <p className="eyebrow" style={{ color: colour }}>
        Spot {index}
      </p>
      <h2>{item.name}</h2>
      <p className="muted">{item.area}</p>
      {item.vibe ? <p className="guide-rec-vibe">{item.vibe}</p> : null}
      {item.editorialNote ? <p className="guide-rec-note">{item.editorialNote}</p> : null}
      <a className="btn btn-secondary" href={href}>
        See More
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
