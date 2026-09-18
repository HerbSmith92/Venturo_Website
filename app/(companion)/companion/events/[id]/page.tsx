import { CompanionDoor } from "@/components/companion/CompanionDoor";
import { CompanionShell } from "@/components/companion/CompanionShell";
import { getCurrentUser } from "@/lib/auth";
import { COMPANION_HOME, COMPANION_LOGIN } from "@/lib/companion";
import { loadPortalEvent } from "@/lib/event-access";
import {
  getEventDoorStats,
  listEventDoorGuests,
  type DoorGuest,
  type DoorStats,
} from "@/lib/host-scanning";
import { redirect } from "next/navigation";

export default async function CompanionEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(COMPANION_LOGIN);

  const { id } = await params;
  let title = "";
  let stats: DoorStats = {
    eventId: id,
    totalGuests: 0,
    scannedGuests: 0,
    remainingGuests: 0,
  };
  let guests: DoorGuest[] = [];

  try {
    const loaded = await loadPortalEvent(id, "door");
    if ("error" in loaded) {
      if (loaded.status === 401) redirect(COMPANION_LOGIN);
    } else {
      title = loaded.event.title;
      [stats, guests] = await Promise.all([getEventDoorStats(id), listEventDoorGuests(id)]);
    }
  } catch {
    // Offline-capable client will fill from the phone cache.
  }

  return (
    <CompanionShell signedIn backHref={COMPANION_HOME} backLabel="Back" title={title}>
      <CompanionDoor
        eventId={id}
        eventTitle={title}
        initialStats={stats}
        initialGuests={guests}
      />
    </CompanionShell>
  );
}
