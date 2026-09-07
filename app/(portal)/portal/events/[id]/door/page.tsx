import { DoorCompanion } from "@/components/portal/DoorCompanion";
import { getCurrentUser } from "@/lib/auth";
import { formatEventWhen } from "@/lib/events";
import {
  assertCanManageEventDoor,
  getEventDoorStats,
  listEventDoorGuests,
  type DoorGuest,
  type DoorStats,
} from "@/lib/host-scanning";
import { PORTAL_EVENTS, PORTAL_LOGIN, portalEventHref } from "@/lib/portal";
import { notFound, redirect } from "next/navigation";

export default async function PortalEventDoorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(PORTAL_LOGIN);

  const { id } = await params;

  let event;
  try {
    event = await assertCanManageEventDoor(id, user.id, user.role);
  } catch {
    notFound();
  }

  let stats: DoorStats;
  let guests: DoorGuest[];
  try {
    [stats, guests] = await Promise.all([
      getEventDoorStats(id),
      listEventDoorGuests(id),
    ]);
  } catch {
    stats = {
      eventId: id,
      totalGuests: 0,
      scannedGuests: 0,
      remainingGuests: 0,
    };
    guests = [];
  }

  return (
    <main className="door-page">
      <p className="muted portal-studio-back">
        <a href={PORTAL_EVENTS}>← My Events</a>
        {" · "}
        <a href={portalEventHref(id)}>Edit event</a>
      </p>
      <p className="muted door-when">
        {formatEventWhen(event.starts_at, event.timezone)}
        {event.venue_name ? ` · ${event.venue_name}` : ""}
        {event.city ? ` · ${event.city}` : ""}
      </p>
      <DoorCompanion
        eventId={id}
        eventTitle={event.title}
        initialStats={stats}
        initialGuests={guests}
      />
    </main>
  );
}
