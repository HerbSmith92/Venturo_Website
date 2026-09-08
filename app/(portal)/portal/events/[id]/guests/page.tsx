import { EventChrome } from "@/components/portal/EventChrome";
import { EventGuests } from "@/components/portal/EventGuests";
import { requirePortalEvent } from "@/lib/event-access";
import { listEventDoorGuests, type DoorGuest } from "@/lib/host-scanning";
import { listEventInvites } from "@/lib/event-marketing";

export default async function PortalGuestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event, canEdit } = await requirePortalEvent(id);
  let guests: DoorGuest[] = [];
  try {
    guests = await listEventDoorGuests(id);
  } catch {
    guests = [];
  }
  const invites = await listEventInvites(id, "rsvp");

  return (
    <main className="portal-studio">
      <EventChrome event={event} current="guests">
        <EventGuests event={event} guests={guests} invites={invites} canEdit={canEdit} />
      </EventChrome>
    </main>
  );
}
