import { loadWebsiteCopy } from "@/lib/website";

export default async function AboutPage() {
  const copy = await loadWebsiteCopy();
  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Venturo</p>
        <h1>{copy.aboutTitle}</h1>
        <p className="lede" style={{ whiteSpace: "pre-wrap" }}>
          {copy.aboutBody}
        </p>
      </section>
    </main>
  );
}
