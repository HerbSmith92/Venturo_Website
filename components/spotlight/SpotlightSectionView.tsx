import {
  photoById,
  sanitizeStoryHtml,
  type PhotoLayout,
  type SpotlightPhoto,
  type SpotlightPlacement,
  type SpotlightSection,
} from "@/lib/spotlight";

export function SpotlightFigure({
  photo,
  placement,
  className,
}: {
  photo: SpotlightPhoto | null;
  placement?: SpotlightPlacement | null;
  className?: string;
}) {
  if (!photo) return null;
  const caption = placement?.caption || "";
  const credit = placement?.credit || "";
  const alt = placement?.alt || photo.alt || caption || "";
  const focusX = placement?.focusX ?? photo.focusX;
  const focusY = placement?.focusY ?? photo.focusY;
  return (
    <figure className={className}>
      <img src={photo.url} alt={alt} style={{ objectPosition: `${focusX}% ${focusY}%` }} />
      {caption || credit ? (
        <figcaption>
          {caption ? <span>{caption}</span> : null}
          {credit ? <em>{credit}</em> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function SpotlightPhotoLayout({
  layout,
  placements,
  photos,
}: {
  layout: PhotoLayout;
  placements: SpotlightPlacement[];
  photos: SpotlightPhoto[];
}) {
  const filled = placements.filter((placement) => placement.photoId);
  if (layout === "none" || filled.length === 0) return null;
  if (layout === "one") {
    const placement = filled[0];
    return <SpotlightFigure className="spotlight-full" photo={photoById(photos, placement.photoId)} placement={placement} />;
  }
  if (layout === "two") {
    return (
      <div className="spotlight-pair">
        {filled.slice(0, 2).map((placement) => (
          <SpotlightFigure key={placement.id} photo={photoById(photos, placement.photoId)} placement={placement} />
        ))}
      </div>
    );
  }
  return (
    <div className="spotlight-inline-gallery">
      {filled.map((placement) => (
        <SpotlightFigure key={placement.id} photo={photoById(photos, placement.photoId)} placement={placement} />
      ))}
    </div>
  );
}

export function SpotlightSectionView({
  section,
  photos,
  authorName,
}: {
  section: SpotlightSection;
  photos: SpotlightPhoto[];
  authorName?: string | null;
}) {
  if (section.type === "quote") {
    return (
      <blockquote className="spotlight-quote">
        {section.text}
        {section.attribution ? <cite>{section.attribution}</cite> : null}
      </blockquote>
    );
  }
  if (section.type === "tip") {
    const first = authorName?.trim().split(/\s+/)[0];
    return (
      <aside className="spotlight-tip">
        <strong>{first ? `${first}’s tip` : "Author’s tip"}</strong>
        <p>{section.text}</p>
      </aside>
    );
  }
  return (
    <section className="spotlight-section">
      {section.heading ? <h2>{section.heading}</h2> : null}
      {section.bodyHtml ? (
        <div className="spotlight-prose" dangerouslySetInnerHTML={{ __html: sanitizeStoryHtml(section.bodyHtml) }} />
      ) : null}
      <SpotlightPhotoLayout layout={section.layout} placements={section.placements} photos={photos} />
    </section>
  );
}
