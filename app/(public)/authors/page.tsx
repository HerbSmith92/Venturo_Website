import { AuthorIndexCard } from "@/components/AuthorIndexCard";
import { listPublicAuthors } from "@/lib/public-authors";

export const metadata = {
  title: "Authors · Venturo",
  description: "The people behind Venturo Guides — locals, hikers, & the odd trail-side storyteller.",
};

export default async function AuthorsIndexPage() {
  const authors = await listPublicAuthors();

  return (
    <main>
      <section className="shell section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Guides</p>
            <h1>Authors</h1>
            <p className="lede muted">
              The people behind the lists — hiking enthusiasts, locals, &amp; influencers whose photo,
              bio &amp; socials travel with every Guide they write.
            </p>
          </div>
          <a className="btn btn-secondary" href="/guides">
            All Guides
          </a>
        </div>
        {authors.length === 0 ? (
          <p className="notice">No authors to show yet. The Guides are still open.</p>
        ) : (
          <div className="author-index-grid">
            {authors.map((author) => (
              <AuthorIndexCard key={author.id} author={author} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
