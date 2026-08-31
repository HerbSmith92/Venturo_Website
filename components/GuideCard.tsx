import type { GuideCardData } from "@/lib/guides";

export function GuideCard({ guide }: { guide: GuideCardData }) {
  const intro =
    guide.intro?.trim() ||
    `${guide.itemCount} ${guide.itemCount === 1 ? "spot" : "spots"} worth getting out for.`;

  return (
    <a className="guide-card" href={`/guides/${guide.slug}`}>
      <div className="guide-card-image">
        <img src={guide.cover} alt="" />
      </div>
      <div className="guide-card-body">
        <p className="eyebrow">Guide</p>
        <h3>{guide.title}</h3>
        <p className="muted">{intro}</p>
        <span className="guide-card-cta">Explore the List →</span>
      </div>
    </a>
  );
}
