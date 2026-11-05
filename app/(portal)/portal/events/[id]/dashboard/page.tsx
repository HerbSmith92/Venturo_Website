import { EventChrome } from "@/components/portal/EventChrome";
import { EventDashboard } from "@/components/portal/EventDashboard";
import { requirePortalEvent } from "@/lib/event-access";
import { getEventDashboard } from "@/lib/event-dashboard";
import { loadHostReport } from "@/lib/event-followups";

export default async function PortalEventDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event, canEdit } = await requirePortalEvent(id);
  const [data, hostReport] = await Promise.all([getEventDashboard(event), loadHostReport(id)]);

  return (
    <main className="portal-studio">
      <EventChrome event={event} current="dashboard">
        <EventDashboard event={event} data={data} canEdit={canEdit} hostReport={hostReport} />
      </EventChrome>
    </main>
  );
}
