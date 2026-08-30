import { EventCard } from "@/components/EventCard";
import { EventMap } from "@/components/EventMap";
import {
  eventHeroImage,
  eventStoryImage,
  formatCents,
  formatEventWhen,
  type EventTicketType,
  type VenturoEvent,
} from "@/lib/event-types";

export function EventPreview({ event }: { event: VenturoEvent }) {
  const hero = eventHeroImage(event);
  const story = eventStoryImage(event);
  const when = event.startsAt ? formatEventWhen(event.startsAt, event.timezone) : "Set a start time";

  return (
    <div className="event-preview">
      <div className="event-preview-surfaces">
        <figure className="story-frame">
          <img src={story} alt="" />
          <figcaption>
            <span className="eyebrow">Story</span>
            <strong>{event.title || "Your adventure"}</strong>
            <span>{when}</span>
          </figcaption>
        </figure>

        <div className="event-preview-card">
          <p className="eyebrow">Feed Card</p>
          <EventCard event={event} showMemberPrice preview />
        </div>
      </div>

      <div className="event-preview-page">
        <p className="eyebrow">Event Page</p>
        <div className="event-detail-hero event-preview-hero">
          <img src={hero} alt="" />
          <div className="event-detail-hero-copy">
            <p className="eyebrow">
              {event.category || "Adventure"}
              {event.audienceGender && event.audienceGender !== "Everyone"
                ? ` · ${event.audienceGender}`
                : ""}
              {event.ageRestriction ? ` · ${event.ageRestriction}` : ""}
            </p>
            <h2>{event.title || "Your adventure name"}</h2>
            <p className="lede">{when}</p>
            <p className="muted">
              {event.venueName || "Venue"}
              {event.city ? ` · ${event.city}` : ""}
            </p>
          </div>
        </div>

        {event.tags.length > 0 && (
          <div className="chips tag-list">
            {event.tags.map((tag) => (
              <span className="chip chip-light" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {event.description ? (
          <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
            {event.description}
          </p>
        ) : (
          <p className="muted">Your story lands here.</p>
        )}

        {event.showMap && (event.addressLine1 || event.venueName) ? (
          <EventMap event={event} />
        ) : null}

        <ul className="preview-ticket-list">
          {event.ticketTypes.map((ticket) => (
            <li key={ticket.id}>
              <strong>{ticket.name || "Ticket"}</strong>
              <span>{ticketPriceLine(ticket)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ticketPriceLine(ticket: EventTicketType) {
  if (ticket.kind === "free" || (ticket.priceCents === 0 && !ticket.membersOnly)) {
    return "Free";
  }
  if (ticket.membersOnly) {
    const member = ticket.memberPriceCents ?? ticket.priceCents;
    return `Members ${formatCents(member)}`;
  }
  if (ticket.memberPriceCents !== null && ticket.memberPriceCents < ticket.priceCents) {
    return `${formatCents(ticket.priceCents)} · members ${formatCents(ticket.memberPriceCents)}`;
  }
  return formatCents(ticket.priceCents);
}
