import type { ReactNode } from "react";
import type { AuthorLatestGuide, GuideAuthorPublic } from "@/lib/guide-authors";
import { authorSocialHref } from "@/lib/guide-authors";

function SocialIcon({
  label,
  href,
  children,
}: {
  label: string;
  href: string | null;
  children: ReactNode;
}) {
  if (!href) return null;
  return (
    <a className="guide-author-icon" href={href} rel="noreferrer" aria-label={label} target="_blank">
      {children}
    </a>
  );
}

export function GuideAuthorCard({
  author,
  latestGuide,
  profileHref,
  onEditCover,
}: {
  author: GuideAuthorPublic;
  latestGuide?: AuthorLatestGuide | null;
  profileHref?: string | null;
  onEditCover?: () => void;
}) {
  const name = author.name.trim() || "Author";
  const initial = name.charAt(0).toUpperCase();
  const instagram = authorSocialHref(author.instagramUrl, "instagram");
  const tiktok = authorSocialHref(author.tiktokUrl, "tiktok");
  const facebook = authorSocialHref(author.facebookUrl, "facebook");
  const website = authorSocialHref(author.websiteUrl, "website");
  const banner = author.cover || author.photo;

  return (
    <aside className="guide-author">
      <div className="guide-author-cover">
        {onEditCover ? (
          <button type="button" className="guide-author-cover-edit" onClick={onEditCover}>
            {banner ? <img src={banner} alt="" /> : null}
            <span>{banner ? "Change cover" : "Add cover"}</span>
          </button>
        ) : banner ? (
          <img src={banner} alt="" />
        ) : null}
      </div>
      {author.photo ? (
        <img className="guide-author-avatar" src={author.photo} alt="" />
      ) : (
        <div className="guide-author-avatar is-fallback" aria-hidden="true">
          {initial}
        </div>
      )}
      <div className="guide-author-body">
        <h2>{profileHref ? <a href={profileHref}>{name}</a> : name}</h2>
        {author.tagline ? <p className="guide-author-tagline">{author.tagline}</p> : null}
        {author.bio ? <p>{author.bio}</p> : null}
        <div className="guide-author-socials">
          <SocialIcon label="Instagram" href={instagram}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
            </svg>
          </SocialIcon>
          <SocialIcon label="TikTok" href={tiktok}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M14.2 3h2.4c.2 1.6 1.1 3 2.4 3.9 1 .7 2.1 1 3.3 1.1v2.5c-1.6 0-3.2-.5-4.6-1.4v6.6c0 3.6-2.9 6.5-6.5 6.5S4.7 19.3 4.7 15.7c0-3.4 2.6-6.2 6-6.5v2.6c-1.9.3-3.4 1.9-3.4 3.9 0 2.2 1.8 3.9 3.9 3.9s3.9-1.8 3.9-3.9V3z"
              />
            </svg>
          </SocialIcon>
          <SocialIcon label="Facebook" href={facebook}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M14.8 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4h1.5V5.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4v1.8H9.2v2.8h2.4V21h3.2z"
              />
            </svg>
          </SocialIcon>
          <SocialIcon label="Website" href={website}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4.5 12h15M12 4.5c2.2 2.4 3.3 5 3.3 7.5s-1.1 5.1-3.3 7.5c-2.2-2.4-3.3-5-3.3-7.5s1.1-5.1 3.3-7.5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </SocialIcon>
        </div>
        {profileHref ? (
          <a className="guide-author-profile" href={profileHref}>
            See all Guides →
          </a>
        ) : null}
        {latestGuide ? (
          <a className="guide-author-latest" href={latestGuide.href}>
            <span className="eyebrow">Latest Guide</span>
            <span>
              {latestGuide.image ? <img src={latestGuide.image} alt="" /> : <span className="guide-author-latest-mark" />}
              <strong>{latestGuide.title}</strong>
            </span>
          </a>
        ) : null}
      </div>
    </aside>
  );
}
