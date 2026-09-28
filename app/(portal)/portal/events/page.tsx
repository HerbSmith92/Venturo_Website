import { CreateEventPrompt } from "@/components/portal/CreateEventPrompt";
import { EventCard } from "@/components/EventCard";
import { getCurrentUser } from "@/lib/auth";
import { listAccessibleEvents } from "@/lib/events";
import { getEventDoorStats } from "@/lib/host-scanning";
import {
  PORTAL_LOGIN,
  portalEventHref,
} from "@/lib/portal";
import { companionEventHref } from "@/lib/companion";
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

  const events = await listAccessibleEvents(user.id);
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
            Open the door on the night, or open the Menu to run the rest.
          </p>
        </div>
      </div>

      <CreateEventPrompt hasEvents={events.length > 0} />

      {events.length === 0 ? (
        <p className="muted">
          No events yet. Create one above &amp; the door tools unlock when it goes live.
        </p>
      ) : (
        <>
          {(
            [
              {
                title: "Drafts & In Review",
                rows: events.filter((event) => event.status === "draft" || event.status === "review" || event.status === "rejected"),
              },
              {
                title: "Published & Upcoming",
                rows: events.filter(
                  (event) =>
                    event.status === "approved" && new Date(event.endsAt).getTime() >= Date.now(),
                ),
              },
              {
                title: "Past & Cancelled",
                rows: events.filter(
                  (event) =>
                    event.status === "cancelled" ||
                    (event.status === "approved" && new Date(event.endsAt).getTime() < Date.now()),
                ),
              },
            ] as const
          ).map((group) =>
            group.rows.length === 0 ? null : (
              <section key={group.title} style={{ marginTop: 28 }}>
                <h2>{group.title}</h2>
                <div className="host-event-list">
                  {group.rows.map((event) => {
                    const stats = statsById.get(event.id);
                    const canDoor = event.status === "approved" || event.status === "cancelled";
                    return (
                      <article key={event.id} className="host-event-card">
                        <EventCard
                          event={event}
                          href={portalEventHref(event.id)}
                          showMemberPrice
                          imageBadge={
                            event.status !== "approved" ? (
                              <span className={`card-status-badge ${event.status}`}>
                                {statusLabel(event.status)}
                              </span>
                            ) : undefined
                          }
                        >
                          {stats ? (
                            <p className="card-meta">
                              {stats.scannedGuests} checked in · {stats.remainingGuests} still to come ·{" "}
                              {stats.totalGuests} on the list
                            </p>
                          ) : null}
                        </EventCard>
                        <div className="host-event-actions">
                          {event.status === "approved" ? (
                            <a className="btn btn-secondary" href={`/events/${event.slug}`}>
                              Public Page
                            </a>
                          ) : null}
                          {canDoor ? (
                            <a className="btn btn-primary" href={companionEventHref(event.id)}>
                              Open Companion
                            </a>
                          ) : (
                            <span className="muted door-locked">Door unlocks when live</span>
                          )}
                          <a className="btn btn-secondary" href={portalEventHref(event.id)}>
                            Menu
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ),
          )}
        </>
      )}
    </main>
  );
}
