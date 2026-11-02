import { GuideCard } from "@/components/GuideCard";
import { liveGuides } from "@/lib/guides";

export default async function GuidesIndexPage() {
  const guides = await liveGuides();

  return (
    <main>
      <section className="shell section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Lists Worth Keeping</p>
            <h1>Guides</h1>
            <p className="lede muted">
              Hand-picked activities &amp; events — weekends, rainy days, cheap dates, &amp; the
              occasional deep dive on one place worth the drive.
            </p>
          </div>
          <a className="btn btn-secondary" href="/authors">
            Authors
          </a>
        </div>
        {guides.length === 0 ? (
          <p className="notice">No live guides right now. The directory is still open.</p>
        ) : (
          <div className="guide-grid">
            {guides.map((guide) => (
              <GuideCard key={`${guide.about ?? "activities"}-${guide.id}`} guide={guide} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
