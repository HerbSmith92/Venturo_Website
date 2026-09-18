import { DoorCompanion } from "@/components/portal/DoorCompanion";
import { EventChrome } from "@/components/portal/EventChrome";
import { companionEventHref } from "@/lib/companion";
import { requirePortalEvent } from "@/lib/event-access";
import {
  getEventDoorStats,
  listEventDoorGuests,
  type DoorGuest,
  type DoorStats,
} from "@/lib/host-scanning";

export default async function PortalEventDoorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event } = await requirePortalEvent(id);

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
      <EventChrome event={event} current="door">
        <aside className="companion-door-banner">
          <p>On a phone at the venue? Open the Companion App — camera, offline list &amp; sync.</p>
          <a className="btn btn-primary" href={companionEventHref(id)}>
            Open Companion
          </a>
        </aside>
        <DoorCompanion
          eventId={id}
          eventTitle={event.title}
          initialStats={stats}
          initialGuests={guests}
        />
      </EventChrome>
    </main>
  );
}
