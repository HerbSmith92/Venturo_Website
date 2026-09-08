import { DoorCompanion } from "@/components/portal/DoorCompanion";
import { EventChrome } from "@/components/portal/EventChrome";
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
