import Link from "next/link";
import {
  eventFeedImage,
  formatCents,
  formatEventWhen,
  type VenturoEvent,
} from "@/lib/event-types";
import { eventCategoryColour } from "@/lib/event-style";

export function EventCard({
  event,
  showMemberPrice = false,
  preview = false,
}: {
  event: VenturoEvent;
  showMemberPrice?: boolean;
  preview?: boolean;
}) {
  const colour = eventCategoryColour(event.category);
  const hasMemberDeal =
    event.memberFromPriceCents !== null &&
    (event.fromPriceCents === null || event.memberFromPriceCents < event.fromPriceCents);

  const className = `card card-event${hasMemberDeal ? " card-deal" : ""}`;
  const style = { ["--card-accent" as string]: colour };
  const body = (
    <>
      <div className="card-image card-image-post">
        <img src={eventFeedImage(event)} alt="" />
        {hasMemberDeal && (
          <span className="deal-badge">
            {event.membersOnly ? "Members" : "Members Save"}
          </span>
        )}
      </div>
      <div className="card-body">
        <p className="card-kicker" style={{ color: colour }}>
          {event.category || "Adventure"}
          {event.audienceGender && event.audienceGender !== "Everyone"
            ? ` · ${event.audienceGender}`
            : ""}
        </p>
        <h3>{event.title || "Untitled adventure"}</h3>
        <p className="card-meta">
          {event.startsAt
            ? formatEventWhen(event.startsAt, event.timezone)
            : "Date coming"}
          {event.city ? ` · ${event.city}` : ""}
        </p>
        <div className="price-row">
          <span className="from-price">{publicPriceLabel(event)}</span>
          {hasMemberDeal && !event.membersOnly && event.memberFromPriceCents !== null && (
            <span className="member-price">
              {showMemberPrice
                ? `Members from ${formatCents(event.memberFromPriceCents)}`
                : "Paid members save"}
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (preview) {
    return (
      <article className={className} style={style}>
        {body}
      </article>
    );
  }

  return (
    <Link className={className} href={`/events/${event.slug}`} style={style}>
      {body}
    </Link>
  );
}

function publicPriceLabel(event: VenturoEvent) {
  if (event.membersOnly && event.memberFromPriceCents !== null) {
    return `Members from ${formatCents(event.memberFromPriceCents)}`;
  }
  if (event.fromPriceCents === null) return "Tickets soon";
  if (event.fromPriceCents === 0) return "Free";
  return `From ${formatCents(event.fromPriceCents)}`;
}
