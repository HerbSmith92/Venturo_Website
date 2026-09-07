import { EventCard } from "@/components/EventCard";
import { EventMap } from "@/components/EventMap";
import { EventPageHero } from "@/components/events/EventPageHero";
import {
  eventStoryImage,
  formatCents,
  formatEventFromPrice,
  formatEventWhen,
  type EventTicketType,
  type VenturoEvent,
} from "@/lib/event-types";

export function EventPreview({ event }: { event: VenturoEvent }) {
  const story = event.storyImageUrl;
  const when = event.startsAt ? formatEventWhen(event.startsAt, event.timezone) : "Set a start time";
  const place = [event.venueName, event.city].filter(Boolean).join(" · ");

  return (
    <div className="event-preview">
      <div className="event-preview-surfaces">
        <div className="preview-tile">
          <p className="eyebrow">Story · 9:16</p>
          <figure className="story-frame">
            {story ? <img src={eventStoryImage(event)} alt="" /> : <div className="preview-empty" />}
            <figcaption>
              <strong>{event.title || "Your adventure"}</strong>
              <span>{when}</span>
            </figcaption>
          </figure>
        </div>

        <div className="preview-tile">
          <p className="eyebrow">Feed Post · 4:5</p>
          {event.listingImageUrl || event.bannerUrl ? (
            <div className="event-preview-card">
              <EventCard event={event} showMemberPrice preview />
            </div>
          ) : (
            <div className="preview-empty preview-empty-card" />
          )}
        </div>
      </div>

      <div className="preview-tile preview-tile-page">
        <p className="eyebrow">Event Page · 16:9</p>
        <EventPageHero
          headingAs="h2"
          className="event-preview-hero"
          imageUrl={event.bannerUrl}
          category={event.category || "Adventure & Thrills"}
          title={event.title || "Your adventure name"}
          place={place}
          priceLabel={event.ticketTypes.length ? formatEventFromPrice(event.fromPriceCents) : null}
        />
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

      {event.showMap && (event.addressLine1 || event.venueName || event.latitude != null) ? (
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
