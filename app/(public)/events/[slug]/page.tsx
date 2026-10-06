import { EventMap } from "@/components/EventMap";
import { EventPageHero } from "@/components/events/EventPageHero";
import { EventViewBeacon } from "@/components/events/EventViewBeacon";
import { SaveForm } from "@/components/SaveForm";
import { TicketCheckoutForm } from "@/components/TicketCheckoutForm";
import { getCurrentUser } from "@/lib/auth";
import {
  eventAddressText,
  formatEventFromPrice,
  formatEventWindow,
  getEventBySlug,
  getPlatformFees,
} from "@/lib/events";
import { nextOccurrence, repeatPhrase } from "@/lib/event-repeat";
import { formatEventWhen } from "@/lib/event-types";
import { isSaved } from "@/lib/saves";
import { notFound } from "next/navigation";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cancelled?: string; c?: string; invite?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const user = await getCurrentUser();
  const fees = await getPlatformFees();
  const saved = user ? await isSaved(user.id, "event", event.id) : false;
  const canView =
    event.status === "approved" ||
    event.status === "cancelled" ||
    event.organiserId === user?.id ||
    user?.role === "admin" ||
    user?.role === "editor";
  if (!canView) notFound();

  const nextDate = nextOccurrence(event.startsAt, event.endsAt, event.repeatEvery, event.repeatUntil);
  const whenStart = nextDate?.startsAt ?? event.startsAt;
  const whenEnd = nextDate?.endsAt ?? event.endsAt;
  const past = !nextDate && Boolean(event.endsAt) && new Date(event.endsAt).getTime() < Date.now();
  const soldOut =
    event.ticketTypes.length > 0 &&
    event.ticketTypes.every((ticket) => ticket.quantity - ticket.soldCount <= 0);
  const freeEvent = (event.fromPriceCents ?? 0) === 0;

  const address = eventAddressText(event);
  const ticketsReady = event.status === "approved" && event.ticketTypes.length > 0;
  const windowLabel = formatEventWindow(whenStart, whenEnd, event.timezone);
  const repeatLabel = event.repeatEvery
    ? `${repeatPhrase(event.repeatEvery)}${event.repeatUntil ? ` until ${formatEventWhen(event.repeatUntil, event.timezone)}` : ""}`
    : "";
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
          {repeatLabel ? <p className="muted">{repeatLabel}</p> : null}
        </div>
        <div className="event-live-bar-item">
          <span className="eyebrow">Where</span>
          <strong>
            {event.venueName || "Venue coming"}
            {event.city ? ` · ${event.city}` : ""}
          </strong>
        </div>
        {event.status === "cancelled" ? (
          <span className="btn btn-secondary" aria-disabled="true">
            Cancelled
          </span>
        ) : past ? (
          <span className="btn btn-secondary" aria-disabled="true">
            Past Event
          </span>
        ) : soldOut ? (
          <span className="btn btn-secondary" aria-disabled="true">
            Sold Out
          </span>
        ) : ticketsReady ? (
          <a className="btn btn-primary" href="#tickets">
            {freeEvent ? "Free RSVP" : "Buy Tickets"}
          </a>
        ) : (
          <span className="btn btn-secondary" aria-disabled="true">
            Sales Closed
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
                <a href={`/portal/events/${event.id}`}>Open Menu</a>
              </>
            ) : null}
          </p>
        )}
        {event.status === "cancelled" ? (
          <p className="error">This event is cancelled.</p>
        ) : null}
        {query.cancelled && (
          <p className="notice">Payment cancelled — grab your spot again below.</p>
        )}
        {query.invite && event.status === "approved" ? (
          <p className="notice">You&apos;re invited. Tickets are below.</p>
        ) : null}

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
            <SaveForm kind="event" targetId={event.id} saved={saved} next={`/events/${event.slug}`} />
            <p className="muted">
              {event.membersOnly
                ? "This event is for Venturo members. Not on Paid yet? Join at checkout—membership plus your ticket in one payment."
                : "Public tickets are open to every profile. Exclusive member tickets: join at checkout—membership plus your ticket in one payment."}
            </p>
            {event.status === "cancelled" ? (
              <p className="error">This event is cancelled. Tickets are closed.</p>
            ) : past ? (
              <p className="notice">This event has passed.</p>
            ) : soldOut ? (
              <p className="notice">Sold out.</p>
            ) : event.status !== "approved" ? (
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
                inviteToken={query.invite ?? ""}
              />
            )}
          </aside>
        </div>
      </section>
      <EventViewBeacon
        eventId={event.id}
        campaignSlug={query.c}
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
