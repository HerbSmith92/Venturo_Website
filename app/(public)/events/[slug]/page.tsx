import { EventMap } from "@/components/EventMap";
import { EventPageHero } from "@/components/events/EventPageHero";
import { EventViewBeacon } from "@/components/events/EventViewBeacon";
import { TicketCheckoutForm } from "@/components/TicketCheckoutForm";
import { getCurrentUser } from "@/lib/auth";
import {
  eventAddressText,
  formatEventFromPrice,
  formatEventWindow,
  getEventBySlug,
  getPlatformFees,
} from "@/lib/events";
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
  const fees = await getPlatformFees();
  const canView =
    event.status === "approved" ||
    event.organiserId === user?.id ||
    user?.role === "admin" ||
    user?.role === "editor";
  if (!canView) notFound();

  const address = eventAddressText(event);
  const ticketsReady = event.status === "approved" && event.ticketTypes.length > 0;
  const windowLabel = formatEventWindow(event.startsAt, event.endsAt, event.timezone);
  const place = [event.venueName, event.city].filter(Boolean).join(" · ");

  return (
    <main>
      <section className="shell">
        <EventPageHero
          imageUrl={event.bannerUrl}
          category={event.category || "Adventure & Thrills"}
          title={event.title}
          place={place}
          priceLabel={formatEventFromPrice(event.fromPriceCents)}
        />
      </section>

      <div className="shell">
        <div className="event-live-bar">
        <div className="event-live-bar-item">
          <span className="eyebrow">When</span>
          <strong>{windowLabel}</strong>
        </div>
        <div className="event-live-bar-item">
          <span className="eyebrow">Where</span>
          <strong>
            {event.venueName || "Venue coming"}
            {event.city ? ` · ${event.city}` : ""}
          </strong>
        </div>
        {ticketsReady ? (
          <a className="btn btn-primary" href="#tickets">
            Buy Tickets
          </a>
        ) : (
          <span className="btn btn-secondary" aria-disabled="true">
            Coming Soon
          </span>
        )}
      </div>
      </div>

      <section className="section shell">
        {event.status !== "approved" && (
          <p className="notice">
            Status: {event.status}. Only you & staff can see this until it is
            approved.
            {event.organiserId === user?.id ? (
              <>
                {" "}
                <a href={`/account/events/${event.id}`}>Open studio</a>
              </>
            ) : null}
          </p>
        )}
        {query.cancelled && (
          <p className="notice">Payment cancelled — grab your spot again below.</p>
        )}

        <div className="event-detail-grid">
          <article className="event-story">
            <div className="event-live-block">
              <p className="eyebrow">Details</p>
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
              <p style={{ whiteSpace: "pre-wrap" }}>
                {event.description || "Details coming soon."}
              </p>
            </div>

            <div className="event-live-block">
              <p className="eyebrow">Information</p>
              <dl className="event-info-list">
                <div>
                  <dt>Age Requirement</dt>
                  <dd>{event.ageRestriction || "All ages"}</dd>
                </div>
                <div>
                  <dt>Prohibited Items</dt>
                  <dd>{event.prohibitedItems || "Standard venue rules apply."}</dd>
                </div>
              </dl>
            </div>

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

          <aside className="event-ticket-panel" id="tickets">
            <div className="colour-bar" aria-hidden="true" />
            <p className="eyebrow">Tickets</p>
            <h2>Claim Your Spot</h2>
            <p className="muted">
              {event.membersOnly
                ? "This event is for Venturo members. Not on Paid yet? Join at checkout—membership plus your ticket in one payment."
                : "Public tickets are open to every profile. Exclusive member tickets: join at checkout—membership plus your ticket in one payment."}
            </p>
            {event.status !== "approved" ? (
              <p className="notice">Tickets unlock once the event is approved.</p>
            ) : event.ticketTypes.length === 0 ? (
              <p className="muted">Coming soon.</p>
            ) : (
              <TicketCheckoutForm
                eventSlug={event.slug}
                tickets={event.ticketTypes}
                paidMember={user?.plan === "paid"}
                loggedIn={Boolean(user)}
                fees={fees}
              />
            )}
          </aside>
        </div>
      </section>
      <EventViewBeacon
        eventId={event.id}
        skip={
          event.status !== "approved" ||
          event.organiserId === user?.id ||
          user?.role === "admin" ||
          user?.role === "editor"
        }
      />
    </main>
  );
}
