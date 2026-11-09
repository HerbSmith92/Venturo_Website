"use client";

import { useMemo, useState } from "react";
import { GuideLikeForm } from "@/components/GuideLikeForm";
import { GuideShareButton } from "@/components/GuideShareButton";
import { PlanVisitCard } from "@/components/PlanVisitCard";
import { SaveForm } from "@/components/SaveForm";
import { formatGuideTally, type GuideKind } from "@/lib/guide-engagement";
import { AuthorSocialLinks, GuideAuthorCard } from "@/components/GuideAuthorCard";
import type { GuideAuthorPublic } from "@/lib/guide-authors";
import { SpotlightSectionView } from "@/components/spotlight/SpotlightSectionView";
import {
  coverPhoto,
  estimateReadMinutes,
  galleryPhotos,
  type SpotlightCover,
  type SpotlightPhoto,
  type SpotlightSection,
  type SpotlightVisitInfo,
} from "@/lib/spotlight";

export function SpotlightArticle({
  title,
  intro,
  slug,
  cover,
  photos,
  story,
  listing,
  author,
  publishedAt,
  updatedAt,
  saved = false,
  saveTargetId,
  like,
  viewCount = 0,
  shareUrl,
  moreByAuthor = [],
  compact = false,
  chip = null,
  kind = null,
}: {
  title: string;
  intro: string;
  slug: string;
  cover: SpotlightCover;
  photos: SpotlightPhoto[];
  story: SpotlightSection[];
  listing: SpotlightVisitInfo | null;
  author: GuideAuthorPublic | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  saved?: boolean;
  saveTargetId?: string;
  like?: { kind: GuideKind; guideId: string; liked: boolean; likeCount: number; next: string };
  viewCount?: number;
  shareUrl?: string;
  moreByAuthor?: { title: string; href: string }[];
  compact?: boolean;
  chip?: string | null;
  kind?: string | null;
}) {
  const hero = coverPhoto(photos, cover);
  const gallery = galleryPhotos(photos);
  const minutes = estimateReadMinutes(intro, story);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const dateLabel = useMemo(() => {
    if (!publishedAt) return null;
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(publishedAt));
  }, [publishedAt]);
  const updatedLabel = useMemo(() => {
    if (!updatedAt || !publishedAt) return null;
    if (new Date(updatedAt).getTime() - new Date(publishedAt).getTime() < 60_000) return null;
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(updatedAt));
  }, [publishedAt, updatedAt]);

  const lightboxPhoto = lightbox != null ? gallery[lightbox] : null;
  const visitPhoto = gallery.find((photo) => photo.url !== hero?.url) ?? gallery[0] ?? hero ?? null;
  const storyPhotoIds = new Set(story.flatMap((section) => section.placements.map((row) => row.photoId)));
  const closerPhotos = gallery.filter((photo) => photo.id !== hero?.id);
  const showCloserLook = closerPhotos.some((photo) => !storyPhotoIds.has(photo.id));

  return (
    <article
      className={`spotlight-page${compact ? " is-compact" : ""}`}
      data-kind={kind || undefined}
    >
      <header className="spotlight-hero">
        {hero ? (
          <img
            className="spotlight-hero-photo"
            src={hero.url}
            alt=""
            style={{ objectPosition: `${cover.focusX}% ${cover.focusY}%` }}
          />
        ) : null}
        <div className={`spotlight-hero-copy is-${cover.textAlign}`}>
          <p className="spotlight-kicker">Activity Spotlight</p>
          <h1>{title || "Untitled Spotlight"}</h1>
          {intro ? <p className="spotlight-hero-intro">{intro}</p> : null}
        </div>
      </header>

      <div className="spotlight-lede">
        {intro ? <p>{intro}</p> : null}
        {chip ? <p className="spotlight-chip">{chip}</p> : null}
      </div>

      <div className="spotlight-bar">
        <div className="spotlight-bar-inner">
          {author ? (
            <a className="spotlight-byline" href={author.slug ? `/authors/${author.slug}` : undefined}>
              {author.photo ? <img src={author.photo} alt="" /> : <span>{author.name.charAt(0)}</span>}
              <div>
                <strong>By {author.name}</strong>
                <p>
                  {minutes} min read
                  {dateLabel ? ` · ${dateLabel}` : ""}
                  {updatedLabel ? ` · Updated ${updatedLabel}` : ""}
                  {viewCount > 0 ? ` · ${formatGuideTally(viewCount, "view", "views")}` : ""}
                </p>
              </div>
            </a>
          ) : (
            <p className="muted">
              {minutes} min read
              {viewCount > 0 ? ` · ${formatGuideTally(viewCount, "view", "views")}` : ""}
            </p>
          )}
          <div className="spotlight-actions">
            {like ? (
              <GuideLikeForm
                kind={like.kind}
                guideId={like.guideId}
                liked={like.liked}
                likeCount={like.likeCount}
                next={like.next}
              />
            ) : null}
            {saveTargetId ? (
              <SaveForm kind="guide" targetId={saveTargetId} saved={saved} next={`/guides/${slug}`} />
            ) : null}
            {shareUrl ? <GuideShareButton url={shareUrl} title={title} /> : null}
          </div>
        </div>
      </div>

      <div className="spotlight-layout">
        <div className="spotlight-story">
          {story.map((section) => (
            <SpotlightSectionView key={section.id} section={section} photos={photos} authorName={author?.name} />
          ))}

          {showCloserLook ? (
            <section className="spotlight-gallery">
              <div className="section-head">
                <h2>A closer look</h2>
                <button type="button" className="btn btn-secondary" onClick={() => setLightbox(0)}>
                  View all {gallery.length} photo{gallery.length === 1 ? "" : "s"}
                </button>
              </div>
              <div className="spotlight-gallery-grid">
                {closerPhotos.slice(0, 3).map((photo, index) => (
                  <button key={photo.id} type="button" onClick={() => setLightbox(gallery.findIndex((row) => row.id === photo.id))}>
                    <img src={photo.url} alt={photo.alt || photo.caption || ""} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {listing ? <PlanVisitCard listing={listing} photo={visitPhoto} variant="end" /> : null}

          {author ? (
            <>
              <aside className="spotlight-author spotlight-author-compact">
                {author.photo ? <img src={author.photo} alt="" /> : <div aria-hidden="true">{author.name.charAt(0)}</div>}
                <div>
                  <p className="eyebrow">Meet your guide</p>
                  <h2>
                    {author.slug ? <a href={`/authors/${author.slug}`}>{author.name}</a> : author.name}
                  </h2>
                  {author.tagline ? <p className="spotlight-author-tag">{author.tagline}</p> : null}
                  {author.bio ? <p>{author.bio}</p> : null}
                  <AuthorSocialLinks author={author} />
                  {moreByAuthor.length > 0 ? (
                    <p>
                      <a href={author.slug ? `/authors/${author.slug}` : "/authors"}>More guides by this author</a>
                    </p>
                  ) : null}
                </div>
              </aside>
              <div className="spotlight-author-full">
                <GuideAuthorCard
                  author={author}
                  profileHref={author.slug ? `/authors/${author.slug}` : null}
                />
              </div>
            </>
          ) : null}
        </div>

        {listing ? <PlanVisitCard listing={listing} photo={visitPhoto} variant="sticky" /> : null}
      </div>

      {lightboxPhoto ? (
        <div className="spotlight-lightbox" role="dialog" aria-modal="true">
          <button type="button" className="spotlight-lightbox-backdrop" aria-label="Close gallery" onClick={() => setLightbox(null)} />
          <div className="spotlight-lightbox-frame">
            <img src={lightboxPhoto.url} alt={lightboxPhoto.alt || lightboxPhoto.caption || ""} />
            {lightboxPhoto.caption || lightboxPhoto.credit ? (
              <p>
                {lightboxPhoto.caption}
                {lightboxPhoto.credit ? ` · ${lightboxPhoto.credit}` : ""}
              </p>
            ) : null}
            <div className="spotlight-lightbox-nav">
              <button type="button" disabled={lightbox === 0} onClick={() => setLightbox((n) => Math.max(0, (n ?? 0) - 1))}>
                Previous
              </button>
              <button type="button" onClick={() => setLightbox(null)}>
                Close
              </button>
              <button
                type="button"
                disabled={lightbox === gallery.length - 1}
                onClick={() => setLightbox((n) => Math.min(gallery.length - 1, (n ?? 0) + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
