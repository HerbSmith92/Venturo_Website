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
  const href = `/directory/${item.slug}`;
  const writeUp = item.editorialNote?.trim();

  return (
    <article className="guide-rec is-stack">
      <header className="guide-rec-copy">
        <p className="eyebrow">{String(index).padStart(2, "0")}</p>
        <h2>{item.name}</h2>
        {writeUp ? <p className="guide-rec-note">{writeUp}</p> : null}
      </header>
      <Link
        className={`card guide-rec-card${memberDeal ? " card-deal" : ""}`}
        href={href}
        style={{ ["--card-accent" as string]: colour }}
      >
        <div className="card-image">
          <img src={item.image} alt="" />
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
          ) : (
            <p className="card-meta">{formatFromPrice(item.fromPrice)}</p>
          )}
        </div>
      </Link>
    </article>
  );
}
