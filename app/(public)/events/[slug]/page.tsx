import { EventMap } from "@/components/EventMap";
import { TicketCheckoutForm } from "@/components/TicketCheckoutForm";
import { getCurrentUser } from "@/lib/auth";
import {
  eventAddressText,
  eventHeroImage,
  formatEventWhen,
  getEventBySlug,
} from "@/lib/events";
import { eventCategoryColour } from "@/lib/event-style";
import { notFound } from "next/navigation";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const user = await getCurrentUser();
  const canView =
    event.status === "approved" ||
    event.organiserId === user?.id ||
    user?.role === "admin" ||
    user?.role === "editor";
  if (!canView) notFound();

  const colour = eventCategoryColour(event.category);
  const heroSrc = eventHeroImage(event);
  const address = eventAddressText(event);

  return (
    <main>
      <section className="shell">
        <div className="event-detail-hero">
          <img src={heroSrc} alt="" />
          <div className="event-detail-hero-copy">
            <p className="eyebrow" style={{ color: colour }}>
              {event.category || "Adventure"}
              {event.audienceGender && event.audienceGender !== "Everyone"
                ? ` · ${event.audienceGender}`
                : ""}
              {event.ageRestriction ? ` · ${event.ageRestriction}` : ""}
            </p>
            <h1>{event.title}</h1>
            <p className="lede">
              {formatEventWhen(event.startsAt, event.timezone)}
              {event.endsAt !== event.startsAt
                ? ` – ${formatEventWhen(event.endsAt, event.timezone)}`
                : ""}
            </p>
            <p className="muted">
              {event.venueName}
              {event.city ? ` · ${event.city}` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="section shell">
        {event.status !== "approved" && (
          <p className="notice">
            Status: {event.status}. Only you & staff can see this until it is
            approved.
          </p>
        )}
        {query.cancelled && (
          <p className="notice">Payment cancelled — grab your spot again below.</p>
        )}

        <div className="event-detail-grid">
          <article className="event-story">
            <p className="eyebrow">The Plan</p>
            <h2>What You&apos;re Walking Into</h2>
            {event.tags.length > 0 && (
              <div className="chips tag-list">
                {event.tags.map((tag) => (
                  <span className="chip chip-light" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p style={{ whiteSpace: "pre-wrap" }}>{event.description}</p>

            {(event.addressLine1 || event.venueName) && (
              <div className="event-venue-card">
                <p className="eyebrow">Meet Here</p>
                <h3>{event.venueName}</h3>
                {address ? <p className="muted">{address}</p> : null}
                {event.showMap ? <EventMap event={event} /> : null}
              </div>
            )}

            <p style={{ marginTop: 28 }}>
              <a className="btn btn-secondary" href="/events">
                More Adventures
              </a>
            </p>
          </article>

          <aside className="event-ticket-panel">
            <div className="colour-bar" aria-hidden="true" />
            <p className="eyebrow">Tickets</p>
            <h2>Claim Your Spot</h2>
            <p className="muted">
              Free profiles can book. Paid members unlock ticket discounts when
              hosts give our members a deal.
            </p>
            {event.status !== "approved" ? (
              <p className="notice">Tickets unlock once the event is approved.</p>
            ) : event.ticketTypes.length === 0 ? (
              <p className="muted">No ticket types yet.</p>
            ) : (
              <TicketCheckoutForm
                eventSlug={event.slug}
                tickets={event.ticketTypes}
                paidMember={user?.plan === "paid"}
                loggedIn={Boolean(user)}
              />
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
