import { EventMap } from "@/components/EventMap";
import { EventDatePicker } from "@/components/events/EventDatePicker";
import { AddToCalendar } from "@/components/events/AddToCalendar";
import { EventPageHero } from "@/components/events/EventPageHero";
import { EventViewBeacon } from "@/components/events/EventViewBeacon";
import { UsageBeacon } from "@/components/UsageBeacon";
import { InviteOthers } from "@/components/InviteOthers";
import { SaveForm } from "@/components/SaveForm";
import { loadAttendancePreview } from "@/lib/event-attendance";
import { TicketCheckoutForm } from "@/components/TicketCheckoutForm";
import { getCurrentUser } from "@/lib/auth";
import {
  eventAddressText,
  formatEventFromPrice,
  formatEventWindow,
  getEventBySlug,
  getPlatformFees,
} from "@/lib/events";
import { listOccurrences, repeatPhrase } from "@/lib/event-repeat";
import { formatEventWhen } from "@/lib/event-types";
import { ticketsSoldForOccurrence } from "@/lib/orders";
import { loadMemberProfile } from "@/lib/profile";
import { isSaved } from "@/lib/saves";
import { hasMemberConsent } from "@/lib/policy-consent";
import { listStoredEventOccurrences } from "@/lib/event-occurrences";
import { joinEventWaitlist, rsvpFreeEvent } from "@/app/event-booking-actions";
import { notFound } from "next/navigation";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    cancelled?: string;
    c?: string;
    invite?: string;
    basket?: string;
    on?: string;
    rsvp?: string;
    order?: string;
    waitlist?: string;
    bookingError?: string;
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const user = await getCurrentUser();
  const fees = await getPlatformFees();
  const occurrences = listOccurrences(event.startsAt, event.endsAt, event.repeatEvery, event.repeatUntil);
  const requested = query.on ? new Date(query.on).getTime() : NaN;
  const selected =
    occurrences.find((item) => new Date(item.startsAt).getTime() === requested) ??
    occurrences[0] ??
    null;
  const whenStart = selected?.startsAt ?? event.startsAt;
  const [saved, attendance] = await Promise.all([
    user ? isSaved(user.id, "event", event.id, whenStart) : Promise.resolve(false),
    loadAttendancePreview(event.id, whenStart),
  ]);
  const [profile, storedOccurrences, consented] = await Promise.all([
    user ? loadMemberProfile(user.id) : Promise.resolve(null),
    listStoredEventOccurrences(event.id),
    user ? hasMemberConsent(user.id) : Promise.resolve(false),
  ]);
  const canView =
    event.status === "approved" ||
    event.status === "cancelled" ||
    event.organiserId === user?.id ||
    user?.role === "admin" ||
    user?.role === "editor";
  if (!canView) notFound();

  const whenEnd = selected?.endsAt ?? event.endsAt;
  const selectedStored =
    storedOccurrences.find((item) => Math.abs(Date.parse(item.startsAt) - Date.parse(whenStart)) < 1000) ??
    storedOccurrences[0] ??
    null;
  const soldForDate = selected ? await ticketsSoldForOccurrence(event.id, selected.startsAt) : new Map<string, number>();
  const publicTickets = event.ticketTypes
    .filter((ticket) => ticket.listed)
    .map((ticket) =>
      event.repeatEvery
        ? { ...ticket, soldCount: soldForDate.get(ticket.id) ?? 0 }
        : ticket,
    );
  const past = !selected && Boolean(event.endsAt) && new Date(event.endsAt).getTime() < Date.now();
  const soldOut =
    publicTickets.length > 0 &&
    publicTickets.every((ticket) => ticket.quantity - ticket.soldCount <= 0);
  const address = eventAddressText(event);
  const ticketsReady =
    event.status === "approved" &&
    (event.bookingMethod === "external" || event.ticketTypes.length > 0);
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
          priceLabel={
            event.priceMix === "both" ? "Free & paid options" : formatEventFromPrice(event.fromPriceCents)
          }
        />
      </section>

      <div className="shell">
        <div className="event-live-bar">
        <div className="event-live-bar-item event-live-when">
          <span className="eyebrow">When</span>
          <strong>{windowLabel}</strong>
          {repeatLabel ? <p className="muted">{repeatLabel}</p> : null}
        </div>
        <div className="event-live-bar-item event-live-where">
          <span className="eyebrow">Where</span>
          <strong>
            {event.venueName || "Venue coming"}
            {event.city ? ` · ${event.city}` : ""}
          </strong>
        </div>
        {occurrences.length > 1 && selected ? (
          <EventDatePicker
            slug={event.slug}
            timezone={event.timezone}
            occurrences={occurrences}
            selectedStartsAt={selected.startsAt}
          />
        ) : null}
        <div className="event-live-actions">
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
          ) : ticketsReady ? null : (
            <span className="btn btn-secondary" aria-disabled="true">
              Sales Closed
            </span>
          )}
          <SaveForm
            kind="event"
            targetId={event.id}
            saved={saved}
            occurrence={whenStart}
            next={`/events/${event.slug}?on=${encodeURIComponent(whenStart)}`}
            label="Interested"
            savedLabel="Interested"
          />
          <InviteOthers title={event.title} path={`/events/${event.slug}`} />
        </div>
      </div>
      {attendance ? (
        <div className="attendance-preview">
          <div className="attendance-faces" aria-hidden="true">
            {attendance.initials.map((letter, index) => (
              <span key={`${letter}-${index}`}>{letter}</span>
            ))}
            {attendance.extra > 0 ? <span>+{attendance.extra}</span> : null}
          </div>
          <p>
            <strong>{attendance.going}</strong> going
            <span> · </span>
            <strong>{attendance.interested}</strong> interested
          </p>
        </div>
      ) : null}
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
        {query.rsvp ? (
          <div className="notice" role="status">
            <strong>You&apos;re going.</strong> {windowLabel}
            {place ? ` · ${place}` : ""}
            <div className="hero-actions" style={{ marginTop: 12 }}>
              <AddToCalendar
                slug={event.slug}
                title={event.title}
                startsAt={whenStart}
                endsAt={whenEnd}
                location={address}
              />
              <a className="btn btn-secondary" href={`/account/tickets${query.order ? `?order=${encodeURIComponent(query.order)}` : ""}`}>
                View confirmation
              </a>
            </div>
          </div>
        ) : null}
        {query.waitlist ? <p className="notice">You&apos;re on the waitlist. We&apos;ll let you know if a place opens.</p> : null}
        {query.bookingError ? <p className="error">{query.bookingError}</p> : null}

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
                {event.organiserDisplayName ? (
                  <div>
                    <dt>Organised by</dt>
                    <dd>{event.organiserDisplayName}</dd>
                  </div>
                ) : null}
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
            <p className="eyebrow">{event.bookingMethod === "free_rsvp" ? "RSVP" : event.bookingMethod === "external" ? "External booking" : "Tickets"}</p>
            <h2>
              {event.bookingMethod === "free_rsvp"
                ? "RSVP free"
                : event.bookingMethod === "external"
                  ? event.externalBookingButtonLabel?.trim() || "Book now"
                  : "Get tickets"}
            </h2>
            {event.bookingMethod === "external" && event.organiserDisplayName ? (
              <p>
                Organised by <strong>{event.organiserDisplayName}</strong>
              </p>
            ) : null}
            <p className="muted">
              {event.bookingMethod === "external"
                ? `Book through ${event.externalProviderName || "the provider"}. Booking & payment take place on their website.`
                : past
                ? "Tickets are closed because this date has passed."
                : event.membersOnly
                  ? user?.plan === "paid"
                    ? "This event is for Venturo members. Your membership is active."
                    : "This event is for Venturo members. Subscribe on the website, then come back for your ticket."
                  : user?.plan === "paid"
                    ? "Public tickets are open. Exclusive member tickets use your membership price."
                    : "Public tickets are open to every profile. Exclusive member tickets need a membership."}
            </p>
            {event.status === "cancelled" ? (
              <p className="error">
                {event.bookingMethod === "external"
                  ? "This event is cancelled. External booking is closed."
                  : "This event is cancelled. Tickets are closed."}
              </p>
            ) : past ? (
              <p className="notice">This event has passed.</p>
            ) : soldOut ? (
              event.waitlistEnabled && selectedStored ? (
                <form action={joinEventWaitlist}>
                  <input type="hidden" name="event_id" value={event.id} />
                  <input type="hidden" name="occurrence_id" value={selectedStored.id} />
                  <input type="hidden" name="ticket_type_id" value={publicTickets[0]?.id ?? ""} />
                  <input type="hidden" name="next" value={`/events/${event.slug}?on=${encodeURIComponent(whenStart)}`} />
                  <button className="btn btn-primary" type="submit">Join waitlist</button>
                </form>
              ) : (
                <p className="notice">Sold out.</p>
              )
            ) : event.status !== "approved" ? (
              <p className="notice">
                {event.bookingMethod === "external"
                  ? "Booking unlocks once the event is approved."
                  : "Tickets unlock once the event is approved."}
              </p>
            ) : event.bookingMethod === "external" ? (
              event.externalBookingUrl ? (
                <a
                  className="btn btn-primary"
                  href={`/go/event-booking/${event.id}${selectedStored ? `?occurrence=${encodeURIComponent(selectedStored.id)}&source=event_page` : "?source=event_page"}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  {event.externalBookingButtonLabel?.trim() || "Book now"}
                </a>
              ) : (
                <p className="notice">Booking is temporarily unavailable.</p>
              )
            ) : publicTickets.length === 0 ? (
              <p className="muted">Coming soon.</p>
            ) : event.bookingMethod === "free_rsvp" && user && consented && Boolean(profile?.phone.trim()) ? (
              <form action={rsvpFreeEvent}>
                <input type="hidden" name="event_slug" value={event.slug} />
                <input type="hidden" name="occurrence_starts_at" value={whenStart} />
                <button className="btn btn-primary" type="submit">RSVP free</button>
              </form>
            ) : (
              <TicketCheckoutForm
                eventSlug={event.slug}
                tickets={publicTickets}
                paidMember={user?.plan === "paid"}
                loggedIn={Boolean(user)}
                hasPhone={Boolean(profile?.phone.trim())}
                fees={fees}
                inviteToken={query.invite ?? ""}
                initialBasket={query.basket}
                occurrenceStartsAt={selected?.startsAt ?? ""}
                occurrenceEndsAt={selected?.endsAt ?? ""}
                occurrenceLabel={windowLabel}
                venueLabel={place}
                needsConsent
              />
            )}
            <p className="muted" style={{ marginTop: 16 }}>
              {event.bookingMethod === "external"
                ? "Interested saves this event for reminders. It does not reserve a place or confirm a booking."
                : "Interested saves this event for later. It does not reserve a place."}
            </p>
            {!past && event.status === "approved" ? (
              <AddToCalendar
                slug={event.slug}
                title={event.title}
                startsAt={whenStart}
                endsAt={whenEnd}
                location={address}
              />
            ) : null}
          </aside>
        </div>
      </section>
      {user && user.role !== "admin" && user.role !== "editor" ? <UsageBeacon kind="view_event" /> : null}
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
