import Link from "next/link";
import {
  categoryColour,
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
        <h3>{item.name}</h3>
        <p className="card-meta">{item.area}</p>
        {memberDeal ? (
          <p className="member-price">
            {paid && item.memberFromPrice !== null
              ? `Members ${formatFromPrice(item.memberFromPrice)}`
              : "Paid members save"}
          </p>
        ) : null}
      </div>
    </Link>
  );

  const copy = (
    <div className="guide-rec-copy">
      <p className="eyebrow">Day {index}</p>
      <h2>{item.name}</h2>
      <p className="guide-rec-place">{item.area}</p>
      {item.vibe ? <p className="guide-rec-vibe">{item.vibe}</p> : null}
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
