import { EventMap } from "@/components/EventMap";
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
import { hasMemberConsent } from "@/lib/policy-consent";
import { loadMemberProfile } from "@/lib/profile";
import { isSaved } from "@/lib/saves";
import { notFound } from "next/navigation";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cancelled?: string; c?: string; invite?: string; basket?: string; on?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const user = await getCurrentUser();
  const fees = await getPlatformFees();
  const [saved, attendance] = await Promise.all([
    user ? isSaved(user.id, "event", event.id) : Promise.resolve(false),
    loadAttendancePreview(event.id),
  ]);
  const profile = user ? await loadMemberProfile(user.id) : null;
  const consented = user ? await hasMemberConsent(user.id) : false;
  const canView =
    event.status === "approved" ||
    event.status === "cancelled" ||
    event.organiserId === user?.id ||
    user?.role === "admin" ||
    user?.role === "editor";
  if (!canView) notFound();

  const occurrences = listOccurrences(event.startsAt, event.endsAt, event.repeatEvery, event.repeatUntil);
  const requested = query.on ? new Date(query.on).getTime() : NaN;
  const selected =
    occurrences.find((item) => new Date(item.startsAt).getTime() === requested) ??
    occurrences[0] ??
    null;
  const whenStart = selected?.startsAt ?? event.startsAt;
  const whenEnd = selected?.endsAt ?? event.endsAt;
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
          priceLabel={
            event.priceMix === "both" ? "Free & paid options" : formatEventFromPrice(event.fromPriceCents)
          }
        />
      </section>

      <div className="shell">
        <div className="event-live-bar">
        <div className="event-live-bar-item">
          <span className="eyebrow">When</span>
          <strong>{windowLabel}</strong>
          {repeatLabel ? <p className="muted">{repeatLabel}</p> : null}
          {occurrences.length > 1 ? (
            <div className="event-date-picker">
              <p className="eyebrow">Choose a date</p>
              <ul className="event-repeat-dates">
                {occurrences.map((occurrence) => (
                  <li key={occurrence.startsAt}>
                    <a
                      href={`/events/${event.slug}?on=${encodeURIComponent(occurrence.startsAt)}#tickets`}
                      aria-current={occurrence.startsAt === selected?.startsAt ? "true" : undefined}
                    >
                      {formatEventWindow(occurrence.startsAt, occurrence.endsAt, event.timezone)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="event-live-bar-item">
          <span className="eyebrow">Where</span>
          <strong>
            {event.venueName || "Venue coming"}
            {event.city ? ` · ${event.city}` : ""}
          </strong>
        </div>
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
          <SaveForm kind="event" targetId={event.id} saved={saved} next={`/events/${event.slug}`} />
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
                ? "This event is for Venturo members. Subscribe on the website, then come back for your ticket."
                : "Public tickets are open to every profile. Exclusive member tickets need a membership. Subscribe on the website, or in the app."}
            </p>
            {event.status === "cancelled" ? (
              <p className="error">This event is cancelled. Tickets are closed.</p>
            ) : past ? (
              <p className="notice">This event has passed.</p>
            ) : soldOut ? (
              <p className="notice">Sold out.</p>
            ) : event.status !== "approved" ? (
              <p className="notice">Tickets unlock once the event is approved.</p>
            ) : publicTickets.length === 0 ? (
              <p className="muted">Coming soon.</p>
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
                needsConsent={!consented}
              />
            )}
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
