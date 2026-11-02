import type { EventGuideCardData } from "@/lib/event-guides";

export function EventGuideCard({ guide }: { guide: EventGuideCardData }) {
  const intro =
    guide.intro?.trim() ||
    `${guide.itemCount} ${guide.itemCount === 1 ? "event" : "events"} still coming up.`;

  return (
    <a className="guide-card" href={`/event-guides/${guide.slug}`}>
      <div className="guide-card-image">
        <img src={guide.cover} alt="" />
      </div>
      <div className="guide-card-body">
        <p className="eyebrow">Event Guide</p>
        <h3>{guide.title}</h3>
        <p className="muted">{intro}</p>
        <span className="guide-card-cta">See what’s on →</span>
      </div>
    </a>
  );
}
