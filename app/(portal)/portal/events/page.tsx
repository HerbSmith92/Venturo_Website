import { CreateEventPrompt } from "@/components/portal/CreateEventPrompt";
import { getCurrentUser } from "@/lib/auth";
import {
  eventFeedImage,
  formatEventWindow,
  listOrganiserEvents,
} from "@/lib/events";
import { PORTAL_LOGIN, portalEventHref } from "@/lib/portal";
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

  return (
    <main className="portal-events">
      <div className="host-events-head section-head">
        <div>
          <p className="eyebrow">Event Host</p>
          <h1>My Events</h1>
          <p className="lede muted">
            Open a listing to edit dates, tickets &amp; details.
          </p>
        </div>
      </div>

      <CreateEventPrompt hasEvents={events.length > 0} />

      {events.length === 0 ? (
        <p className="muted">No events yet. Create one above and it lands here.</p>
      ) : (
        <div className="host-event-list">
          {events.map((event) => {
            const image = eventFeedImage(event);
            const when = formatEventWindow(
              event.startsAt,
              event.endsAt,
              event.timezone,
            );
            return (
              <a
                key={event.id}
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
                </div>
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}
