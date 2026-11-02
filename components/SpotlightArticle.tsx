"use client";

import { useMemo, useState } from "react";
import { SaveForm } from "@/components/SaveForm";
import { formatDay, formatHours } from "@/lib/control-room-shared";
import type { GuideAuthorPublic } from "@/lib/guide-authors";
import { authorSocialHref } from "@/lib/guide-authors";
import { SpotlightSectionView } from "@/components/spotlight/SpotlightSectionView";
import {
  coverPhoto,
  estimateReadMinutes,
  galleryPhotos,
  spotlightPriceLabel,
  type SpotlightCover,
  type SpotlightPhoto,
  type SpotlightSection,
  type SpotlightVisitInfo,
} from "@/lib/spotlight";

function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button className="btn btn-secondary" type="button" onClick={share}>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

function VisitRows({ listing }: { listing: SpotlightVisitInfo }) {
  const price = spotlightPriceLabel(listing.fromPrice);
  const hours = listing.hours.filter((row) => row.opensAt || row.closesAt || row.isClosed);
  const suitability =
    listing.indoorOutdoor === "indoor"
      ? "Indoor"
      : listing.indoorOutdoor === "outdoor"
        ? "Outdoor"
        : listing.indoorOutdoor === "both"
          ? "Indoor & outdoor"
          : null;
  return (
    <dl className="spotlight-visit-list">
      {listing.area ? (
        <>
          <dt>Location</dt>
          <dd>{listing.area}</dd>
        </>
      ) : null}
      {price ? (
        <>
          <dt>Price</dt>
          <dd>{price}</dd>
        </>
      ) : (
        <>
          <dt>Price</dt>
          <dd>
            <a href={`/directory/${listing.slug}`}>View latest pricing</a>
          </dd>
        </>
      )}
      {hours.length ? (
        <>
          <dt>Hours</dt>
          <dd>
            {hours.slice(0, 3).map((row) => (
              <div key={row.dayOfWeek}>
                {formatDay(row.dayOfWeek)} · {formatHours(row.opensAt, row.closesAt, row.isClosed)}
              </div>
            ))}
            {hours.length > 3 ? (
              <a href={`/directory/${listing.slug}`}>Check opening times</a>
            ) : null}
          </dd>
        </>
      ) : (
        <>
          <dt>Hours</dt>
          <dd>
            <a href={`/directory/${listing.slug}`}>Check opening times</a>
          </dd>
        </>
      )}
      {listing.bookingRequired || listing.bookingUrl ? (
        <>
          <dt>Booking</dt>
          <dd>
            {listing.bookingUrl ? (
              <a href={listing.bookingUrl} rel="noreferrer" target="_blank">
                Check availability
              </a>
            ) : (
              "Booking required"
            )}
          </dd>
        </>
      ) : null}
      {suitability ? (
        <>
          <dt>Best for</dt>
          <dd>{suitability}</dd>
        </>
      ) : null}
    </dl>
  );
}

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
  shareUrl,
  moreByAuthor = [],
  compact = false,
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
  shareUrl?: string;
  moreByAuthor?: { title: string; href: string }[];
  compact?: boolean;
}) {
  const hero = coverPhoto(photos, cover);
  const gallery = galleryPhotos(photos);
  const minutes = estimateReadMinutes(intro, story);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const instagram = author ? authorSocialHref(author.instagramUrl, "instagram") : null;
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

  return (
    <article className={`spotlight-page${compact ? " is-compact" : ""}`}>
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
          {intro ? <p>{intro}</p> : null}
        </div>
      </header>

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
                </p>
              </div>
            </a>
          ) : (
            <p className="muted">{minutes} min read</p>
          )}
          <div className="spotlight-actions">
            {saveTargetId ? (
              <SaveForm kind="guide" targetId={saveTargetId} saved={saved} next={`/guides/${slug}`} />
            ) : null}
            {shareUrl ? <ShareButton url={shareUrl} title={title} /> : null}
          </div>
        </div>
      </div>

      <div className="spotlight-layout">
        <div className="spotlight-story">
          {listing ? (
            <aside className="spotlight-visit is-mobile">
              <p className="eyebrow">Plan your visit</p>
              <h2>{listing.name}</h2>
              <p>{listing.area}</p>
              <a className="btn btn-primary" href={`/directory/${listing.slug}`}>
                View activity
              </a>
            </aside>
          ) : null}

          {story.map((section) => (
            <SpotlightSectionView key={section.id} section={section} photos={photos} authorName={author?.name} />
          ))}

          {gallery.length > 0 ? (
            <section className="spotlight-gallery">
              <div className="section-head">
                <h2>A closer look</h2>
                <button type="button" className="btn btn-secondary" onClick={() => setLightbox(0)}>
                  View all {gallery.length} photo{gallery.length === 1 ? "" : "s"}
                </button>
              </div>
              <div className="spotlight-gallery-grid">
                {gallery.slice(0, 3).map((photo, index) => (
                  <button key={photo.id} type="button" onClick={() => setLightbox(index)}>
                    <img src={photo.url} alt={photo.alt || photo.caption || ""} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {listing ? (
            <aside className="spotlight-visit is-end">
              <p className="eyebrow">Plan your visit</p>
              <h2>{listing.name}</h2>
              <VisitRows listing={listing} />
              <p className="muted">Confirm current details before visiting.</p>
              <a className="btn btn-primary" href={`/directory/${listing.slug}`}>
                View activity
              </a>
            </aside>
          ) : null}

          {author ? (
            <aside className="spotlight-author">
              {author.photo ? <img src={author.photo} alt="" /> : <div>{author.name.charAt(0)}</div>}
              <div>
                <p className="eyebrow">Meet your guide</p>
                <h2>
                  {author.slug ? <a href={`/authors/${author.slug}`}>{author.name}</a> : author.name}
                </h2>
                {author.tagline ? <p className="spotlight-author-tag">{author.tagline}</p> : null}
                {author.bio ? <p>{author.bio}</p> : null}
                {instagram ? (
                  <p>
                    <a href={instagram} rel="noreferrer" target="_blank">
                      @{instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "")}
                    </a>
                  </p>
                ) : null}
                {moreByAuthor.length > 0 ? (
                  <p>
                    <a href={author.slug ? `/authors/${author.slug}` : "/authors"}>More guides by this author</a>
                  </p>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>

        {listing ? (
          <aside className="spotlight-visit is-sticky">
            <p className="eyebrow">Plan your visit</p>
            {photos.find((photo) => photo.gallery) ? (
              <img src={(gallery[0] ?? hero)?.url} alt="" />
            ) : hero ? (
              <img src={hero.url} alt="" />
            ) : null}
            <h2>{listing.name}</h2>
            <VisitRows listing={listing} />
            <a className="btn btn-primary" href={`/directory/${listing.slug}`}>
              View activity
            </a>
            <p className="muted">Confirm current details before visiting.</p>
          </aside>
        ) : null}
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
