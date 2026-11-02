import type { GuideCardData } from "@/lib/guides";

function eyebrow(guide: GuideCardData) {
  if (guide.shape === "spotlight") return "Spotlight";
  if (guide.about === "events") {
    return guide.itemCount === 1 ? "1 event" : `${guide.itemCount} events`;
  }
  return guide.itemCount === 1 ? "1 spot" : `${guide.itemCount} spots`;
}

export function GuideCard({ guide }: { guide: GuideCardData }) {
  const intro =
    guide.intro?.trim() ||
    (guide.shape === "spotlight"
      ? "A closer look at one worth leaving the house for."
      : `${guide.itemCount} ${guide.itemCount === 1 ? "spot" : "spots"} worth getting out for.`);

  return (
    <a className="guide-card" href={`/guides/${guide.slug}`}>
      <div className="guide-card-image">
        <img src={guide.cover} alt="" />
      </div>
      <div className="guide-card-body">
        <p className="eyebrow">Guide · {eyebrow(guide)}</p>
        <h3>{guide.title}</h3>
        {guide.authorName ? <p className="muted">By {guide.authorName}</p> : null}
        <p className="muted">{intro}</p>
        <span className="guide-card-cta">
          {guide.shape === "spotlight" ? "Read the Guide →" : "Explore the List →"}
        </span>
      </div>
    </a>
  );
}
