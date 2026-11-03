import { GuideAuthorCard } from "@/components/GuideAuthorCard";
import { GuideBrowse } from "@/components/GuideBrowse";
import { EventGuideRecommendationBlock } from "@/components/EventGuideRecommendation";
import { GuideRecommendationBlock } from "@/components/GuideRecommendation";
import { SaveForm } from "@/components/SaveForm";
import type { GuideAuthorPublic } from "@/lib/guide-authors";
import type { EventGuideRecommendation } from "@/lib/event-guides";
import type { GuideCardData, GuideRecommendation } from "@/lib/guides";
import type { VenturoEvent } from "@/lib/event-types";

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
          {save ? <SaveForm kind="guide" targetId={save.targetId} saved={save.saved} next={save.next} /> : null}
        </header>

        <div className={moreGuides.length > 0 ? "guide-layout" : undefined}>
          <div className="guide-collection-main">
            {author ? <GuideAuthorCard author={author} profileHref={author.slug ? `/authors/${author.slug}` : null} /> : null}
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
                <h2>Linked events</h2>
                <ul>
                  {linkedEvents.map((event) =>
                    event ? (
                      <li key={event.id}>
                        <a href={`/events/${event.slug}`}>{event.title}</a>
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            ) : null}
          </div>
          <GuideBrowse guides={moreGuides} />
        </div>
      </div>
    </main>
  );
}
