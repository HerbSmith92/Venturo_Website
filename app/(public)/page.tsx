import { loadWebsiteCopy } from "@/lib/website";

export default async function HomePage() {
  const copy = await loadWebsiteCopy();

  return (
    <main>
      <section className="shell">
        <div className="hero">
          <img src={copy.heroImageUrl} alt="" />
          <div className="hero-copy">
            <p className="eyebrow">{copy.heroEyebrow}</p>
            <h1>{copy.heroTitle}</h1>
            <p className="lede">{copy.heroLede}</p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="/directory">
                Open The Directory
              </a>
              <a className="btn btn-secondary" href="/events">
                See What&apos;s On
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
