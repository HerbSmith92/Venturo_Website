import { EventActions } from "@/components/admin/EventActions";
import {
  eventImage,
  formatCents,
  formatEventWhen,
  getEventById,
} from "@/lib/events";
import { notFound } from "next/navigation";

export default async function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  return (
    <div className="cr-paper">
      <p className="eyebrow">Event Review</p>
      <h1>{event.title}</h1>
      <p className="muted">
        <span className={`status-pill ${event.status}`}>{event.status}</span>
        {" · "}
        {formatEventWhen(event.startsAt, event.timezone)}
        {event.audienceGender ? ` · ${event.audienceGender}` : ""}
      </p>

      {event.tags.length > 0 && (
        <p className="muted" style={{ marginTop: 8 }}>
          {event.tags.join(" · ")}
        </p>
      )}

      <img
        src={eventImage(event)}
        alt=""
        style={{
          width: "100%",
          maxHeight: 280,
          objectFit: "cover",
          borderRadius: 16,
          margin: "24px 0",
        }}
      />

      <p style={{ whiteSpace: "pre-wrap" }}>{event.description}</p>
      <p className="muted" style={{ marginTop: 16 }}>
        {event.venueName}
        {[event.addressLine1, event.city].filter(Boolean).length
          ? ` · ${[event.addressLine1, event.city].filter(Boolean).join(", ")}`
          : ""}
      </p>

      <h2 style={{ marginTop: 28 }}>Ticket Types</h2>
      <ul>
        {event.ticketTypes.map((ticket) => (
          <li key={ticket.id}>
            {ticket.name} —{" "}
            {ticket.membersOnly
              ? `Members ${formatCents(ticket.memberPriceCents ?? ticket.priceCents)}`
              : formatCents(ticket.priceCents)}
            {!ticket.membersOnly && ticket.memberPriceCents !== null
              ? ` (members ${formatCents(ticket.memberPriceCents)})`
              : ""}{" "}
            · {ticket.soldCount}/{ticket.quantity} sold
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 32 }}>
        <EventActions eventId={event.id} status={event.status} />
      </div>

      <p style={{ marginTop: 24 }}>
        <a href={`/events/${event.slug}`} className="btn btn-secondary">
          Open Public Page
        </a>
      </p>
    </div>
  );
}
