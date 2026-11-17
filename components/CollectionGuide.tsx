import { GuideAuthorCard } from "@/components/GuideAuthorCard";
import { GuideBrowse } from "@/components/GuideBrowse";
import { EventGuideRecommendationBlock } from "@/components/EventGuideRecommendation";
import { GuideRecommendationBlock } from "@/components/GuideRecommendation";
import { GuideLikeForm } from "@/components/GuideLikeForm";
import { GuideShareButton } from "@/components/GuideShareButton";
import { SaveForm } from "@/components/SaveForm";
import { formatGuideTally, type GuideKind } from "@/lib/guide-engagement";
import type { GuideAuthorPublic } from "@/lib/guide-authors";
import type { EventGuideRecommendation } from "@/lib/event-guides";
import type { GuideCardData, GuideRecommendation } from "@/lib/guides";
import { formatEventWindow, type VenturoEvent } from "@/lib/event-types";

function guideDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function linkedEventState(event: VenturoEvent) {
  if (event.status === "cancelled") return "Cancelled";
  if (event.endsAt && Date.parse(event.endsAt) < Date.now()) return "Ended";
  if (event.bookingMethod === "free_rsvp") return "RSVP free";
  if (event.bookingMethod === "external") return `External booking · ${event.externalProviderName || "Provider"}`;
  return "Get tickets";
}

export function CollectionGuide({
  title,
  intro,
  body,
  about,
  publishedAt,
  author,
  listingItems,
  eventItems,
  moreGuides,
  linkedEvents,
  paid = false,
  save,
  like,
  viewCount = 0,
  shareUrl,
}: {
  title: string;
  intro: string | null;
  body: string | null;
  about: "activities" | "events";
  publishedAt?: string | null;
  author: GuideAuthorPublic | null;
  listingItems?: GuideRecommendation[];
  eventItems?: EventGuideRecommendation[];
  moreGuides: GuideCardData[];
  linkedEvents?: VenturoEvent[];
  paid?: boolean;
  save?: { targetId: string; saved: boolean; next: string };
  like?: { kind: GuideKind; guideId: string; liked: boolean; likeCount: number; next: string };
  viewCount?: number;
  shareUrl?: string;
}) {
  const dateLabel = guideDate(publishedAt);
  const items = listingItems ?? [];
  const events = eventItems ?? [];

  return (
    <main className="guide-collection">
      <div className="shell">
        <header className="guide-collection-head">
          <p className="eyebrow">
            <a href="/guides">Guides</a>
            {dateLabel ? ` · ${dateLabel}` : about === "events" ? " · Events" : null}
          </p>
          <h1>{title}</h1>
          {intro ? <p className="guide-collection-intro">{intro}</p> : null}
        </header>
      </div>

      <div className="spotlight-bar">
        <div className="spotlight-bar-inner">
          {author ? (
            <a className="spotlight-byline" href={author.slug ? `/authors/${author.slug}` : undefined}>
              {author.photo ? <img src={author.photo} alt="" /> : <span>{author.name.charAt(0)}</span>}
              <div>
                <strong>By {author.name}</strong>
                <p>
                  {dateLabel ? dateLabel : "Collection"}
                  {viewCount > 0 ? ` · ${formatGuideTally(viewCount, "view", "views")}` : ""}
                </p>
              </div>
            </a>
          ) : (
            <p className="muted">
              {dateLabel}
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
            {save ? <SaveForm kind="guide" targetId={save.targetId} saved={save.saved} next={save.next} /> : null}
            {shareUrl ? <GuideShareButton url={shareUrl} title={title} /> : null}
          </div>
        </div>
      </div>

      <div className="shell">
        <div className={moreGuides.length > 0 ? "guide-layout" : undefined}>
          <div className="guide-collection-main">
            {body ? <p className="guide-collection-body">{body}</p> : null}
            <div className="guide-recs">
              {items.map((item, index) => (
                <GuideRecommendationBlock key={item.listingId} item={item} index={index + 1} paid={paid} />
              ))}
              {events.map((item, index) => (
                <EventGuideRecommendationBlock key={item.eventId} item={item} index={index + 1} />
              ))}
            </div>
            {linkedEvents && linkedEvents.length > 0 ? (
              <div className="guide-collection-events">
                <h2>Events in this guide</h2>
                <div className="grid">
                  {linkedEvents.map((event) => (
                    <a className="card" href={`/events/${event.slug}`} key={event.id}>
                      {event.listingImageUrl || event.bannerUrl ? (
                        <div className="card-image card-image-post">
                          <img src={event.listingImageUrl || event.bannerUrl || ""} alt="" />
                        </div>
                      ) : null}
                      <div className="card-body">
                        <p className="card-kicker">{linkedEventState(event)}</p>
                        <h3>{event.title}</h3>
                        <p className="card-meta">{formatEventWindow(event.startsAt, event.endsAt, event.timezone)}</p>
                        <p className="card-meta">{[event.venueName, event.city].filter(Boolean).join(" · ")}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {author ? (
              <div className="guide-collection-author">
                <GuideAuthorCard author={author} profileHref={author.slug ? `/authors/${author.slug}` : null} />
              </div>
            ) : null}
          </div>
          <GuideBrowse guides={moreGuides} />
        </div>
      </div>
    </main>
  );
}
