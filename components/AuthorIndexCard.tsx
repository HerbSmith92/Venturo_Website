import type { PublicAuthorListItem } from "@/lib/public-authors";

function guideCountLabel(count: number) {
  return count === 1 ? "1 Guide" : `${count} Guides`;
}

export function AuthorIndexCard({ author }: { author: PublicAuthorListItem }) {
  const initial = author.name.charAt(0).toUpperCase();
  return (
    <a className="author-index-card" href={`/authors/${author.slug}`}>
      {author.photo ? (
        <img src={author.photo} alt="" />
      ) : (
        <span className="author-index-fallback" aria-hidden="true">
          {initial}
        </span>
      )}
      <div>
        <p className="eyebrow">{guideCountLabel(author.guideCount)}</p>
        <h3>{author.name}</h3>
        {author.tagline ? <p className="muted">{author.tagline}</p> : null}
      </div>
    </a>
  );
}
