import { EventChrome } from "@/components/portal/EventChrome";
import { EventMenuHub } from "@/components/portal/EventMenuHub";
import { requirePortalEvent } from "@/lib/event-access";

export default async function PortalEventMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event } = await requirePortalEvent(id);

  return (
    <main className="portal-studio">
      <EventChrome event={event} current="menu">
        <EventMenuHub event={event} />
      </EventChrome>
    </main>
  );
}
