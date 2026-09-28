import type { Metadata } from "next";
import { loadWebsiteCopy } from "@/lib/website";

export const metadata: Metadata = {
  title: "Support · Venturo",
};

export default async function SupportPage() {
  const copy = await loadWebsiteCopy();
  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Here To Help</p>
        <h1>Support</h1>
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
