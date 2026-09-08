import { CreateEventPrompt } from "@/components/portal/CreateEventPrompt";
import { getCurrentUser } from "@/lib/auth";
import {
  eventFeedImage,
  formatEventWindow,
  listOrganiserEvents,
} from "@/lib/events";
import { getEventDoorStats } from "@/lib/host-scanning";
import {
  PORTAL_LOGIN,
  portalDoorHref,
  portalEventHref,
} from "@/lib/portal";
import { redirect } from "next/navigation";

function statusLabel(status: string) {
  if (status === "approved") return "Live";
  if (status === "review") return "In Review";
  if (status === "draft") return "Draft";
  if (status === "cancelled") return "Cancelled";
  return status;
}

export default async function PortalEventsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(PORTAL_LOGIN);

  const events = await listOrganiserEvents(user.id);
  const doorStats = await Promise.all(
    events
      .filter((event) => event.status === "approved" || event.status === "cancelled")
      .map(async (event) => {
        try {
          const stats = await getEventDoorStats(event.id);
          return [event.id, stats] as const;
        } catch {
          return [event.id, null] as const;
        }
      }),
  );
  const statsById = new Map(doorStats);

  return (
    <main className="portal-events">
      <div className="host-events-head section-head">
        <div>
          <p className="eyebrow">Event Host</p>
          <h1>My Events</h1>
          <p className="lede muted">
            Open the door on the night, or polish the listing before guests arrive.
          </p>
        </div>
      </div>

      <CreateEventPrompt hasEvents={events.length > 0} />

      {events.length === 0 ? (
        <p className="muted">
          No events yet. Create one above &amp; the door tools unlock when it goes live.
        </p>
      ) : (
        <div className="host-event-list">
          {events.map((event) => {
            const image = eventFeedImage(event);
            const stats = statsById.get(event.id);
            const canDoor = event.status === "approved" || event.status === "cancelled";
            const when = formatEventWindow(
              event.startsAt,
              event.endsAt,
              event.timezone,
            );
            return (
              <article key={event.id} className="host-event-card">
                <a
                  className="host-event-row portal-my-event-row"
                  href={portalEventHref(event.id)}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" />
                  ) : (
                    <span className="portal-my-event-ph" aria-hidden="true" />
                  )}
                  <div>
                    <span className={`status-pill ${event.status}`}>
                      {statusLabel(event.status)}
                    </span>
                    <h2>{event.title}</h2>
                    <p className="muted">
                      {when}
                      {event.venueName
                        ? ` · ${event.venueName}`
                        : event.city
                          ? ` · ${event.city}`
                          : ""}
                    </p>
                    {stats && (
                      <p className="muted">
                        {stats.scannedGuests} scanned · {stats.remainingGuests} still to come ·{" "}
                        {stats.totalGuests} on the list
                      </p>
                    )}
                  </div>
                </a>
                <div className="host-event-actions">
                  {canDoor ? (
                    <a className="btn btn-primary" href={portalDoorHref(event.id)}>
                      Open Door
                    </a>
                  ) : (
                    <span className="muted door-locked">Door unlocks when live</span>
                  )}
                  <a className="btn btn-secondary" href={portalEventHref(event.id)}>
                    Edit
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
