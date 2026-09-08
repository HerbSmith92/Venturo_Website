import { EventPageHero } from "@/components/events/EventPageHero";
import { formatEventFromPrice, formatEventWindow } from "@/lib/events";
import { PORTAL_EVENTS } from "@/lib/portal";
import type { VenturoEvent } from "@/lib/event-types";

export function EventChrome({
  event,
  children,
}: {
  event: VenturoEvent;
  current?: string;
  children: React.ReactNode;
}) {
  const place = [event.venueName, event.city].filter(Boolean).join(" · ");
  const when = formatEventWindow(event.startsAt, event.endsAt, event.timezone);

  return (
    <div className="event-menu-shell">
      <p className="muted portal-studio-back">
        <a href={PORTAL_EVENTS}>← My Events</a>
      </p>
      <EventPageHero
        className="studio-page-hero"
        imageUrl={event.bannerUrl}
        category={event.category || "Adventure & Thrills"}
        title={event.title}
        place={[when, place].filter(Boolean).join(" · ")}
        priceLabel={
          event.ticketTypes.length ? formatEventFromPrice(event.fromPriceCents) : null
        }
      />
      {children}
    </div>
  );
}
