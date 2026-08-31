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
              Hand-picked spots from the directory — weekends, rainy days, &
              everything in between.
            </p>
          </div>
        </div>
        {guides.length === 0 ? (
          <p className="notice">No live guides right now. The directory is still open.</p>
        ) : (
          <div className="guide-grid">
            {guides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
