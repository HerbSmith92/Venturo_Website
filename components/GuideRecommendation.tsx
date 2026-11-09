import { PlanVisitRows } from "@/components/PlanVisitCard";
import {
  categoryColour,
  visitFromRecommendation,
  type GuideRecommendation,
} from "@/lib/guides";

export function GuideRecommendationBlock({
  item,
  index,
}: {
  item: GuideRecommendation;
  index: number;
  paid?: boolean;
}) {
  const writeUp = item.editorialNote?.trim();
  const colour = categoryColour(item.category);
  const listing = visitFromRecommendation(item);
  const href = `/directory/${item.slug}`;

  return (
    <article className="guide-rec" style={{ ["--kind" as string]: colour }}>
      <div className="guide-rec-photo">
        <img src={item.image} alt="" />
      </div>
      <div className="guide-rec-side">
        <div className="guide-rec-facts">
          <p className="eyebrow">{String(index).padStart(2, "0")}</p>
          <h2>{item.name}</h2>
          <PlanVisitRows listing={listing} />
          <p className="spotlight-visit-note">Confirm current details before visiting.</p>
          <a className="btn btn-primary" href={href}>
            View activity
          </a>
        </div>
        {writeUp ? <p className="guide-rec-note">{writeUp}</p> : null}
      </div>
    </article>
  );
}
