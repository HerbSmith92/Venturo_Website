import { loadWebsiteCopy } from "@/lib/website";

export default async function HelpPage() {
  const copy = await loadWebsiteCopy();
  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Support</p>
        <h1>{copy.helpTitle}</h1>
        <p className="lede" style={{ whiteSpace: "pre-wrap" }}>
          {copy.helpBody}
        </p>
        <p>
          <a className="btn btn-primary" href={`mailto:${copy.helpEmail}`}>
            {copy.helpEmail}
          </a>
        </p>
        <div className="hero-actions" style={{ marginTop: 24 }}>
          <a className="btn btn-secondary" href={copy.appStoreUrl}>
            App Store
          </a>
          <a className="btn btn-secondary" href={copy.playStoreUrl}>
            Google Play
          </a>
        </div>
      </section>
    </main>
  );
}
