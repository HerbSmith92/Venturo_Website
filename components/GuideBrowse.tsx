import type { GuideCardData } from "@/lib/guides";

export function GuideBrowse({ guides }: { guides: GuideCardData[] }) {
  if (guides.length === 0) return null;

  return (
    <aside className="guide-browse" aria-label="Browse other guides">
      <h2>Browse Other Guides</h2>
      <ul className="guide-browse-list">
        {guides.map((guide) => (
          <li key={guide.id}>
            <a href={`/guides/${guide.slug}`}>
              <img src={guide.cover} alt="" />
              <span>
                <h3>{guide.title}</h3>
                <p className="muted">
                  {guide.itemCount} {guide.itemCount === 1 ? "spot" : "spots"}
                </p>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <a className="guide-browse-all" href="/guides">
        All Guides →
      </a>
    </aside>
  );
}
