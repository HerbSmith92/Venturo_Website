import { AuthorIndexCard } from "@/components/AuthorIndexCard";
import { GuideAuthorCard } from "@/components/GuideAuthorCard";
import { GuideCard } from "@/components/GuideCard";
import { liveGuidesByAuthor } from "@/lib/guides";
import { getPublicAuthorBySlug, listPublicAuthors } from "@/lib/public-authors";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = await getPublicAuthorBySlug(slug);
  if (!author) return { title: "Author · Venturo" };
  return {
    title: `${author.name} · Authors · Venturo`,
    description: author.tagline || author.bio || `Guides by ${author.name} on Venturo.`,
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = await getPublicAuthorBySlug(slug);
  if (!author) notFound();
  const [guides, others] = await Promise.all([liveGuidesByAuthor(author.id), listPublicAuthors()]);
  const moreAuthors = others.filter((item) => item.id !== author.id).slice(0, 6);
  const countLabel = guides.length === 1 ? "1 Guide" : `${guides.length} Guides`;

  return (
    <main>
      <section className="shell section">
        <p className="eyebrow">
          <a href="/guides">Guides</a>
          {" · "}
          <a href="/authors">Authors</a>
        </p>
        <div className="author-profile">
          <GuideAuthorCard author={author} />
          <div>
            <p className="eyebrow">Guides</p>
            <h1>{countLabel}</h1>
            <p className="muted">Every live Guide with this name on it.</p>
          </div>
        </div>
      </section>
      <section className="shell section" style={{ paddingTop: 0 }}>
        {guides.length === 0 ? (
          <p className="notice">No live Guides for this author yet.</p>
        ) : (
          <div className="guide-grid">
            {guides.map((guide) => (
              <GuideCard key={`${guide.about ?? "activities"}-${guide.id}`} guide={guide} />
            ))}
          </div>
        )}
      </section>
      {moreAuthors.length > 0 ? (
        <section className="shell section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Authors</p>
              <h2>More people behind the lists</h2>
            </div>
            <a className="btn btn-secondary" href="/authors">
              All Authors
            </a>
          </div>
          <div className="author-index-grid">
            {moreAuthors.map((item) => (
              <AuthorIndexCard key={item.id} author={item} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
