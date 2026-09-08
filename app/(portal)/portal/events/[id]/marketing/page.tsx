import { EventChrome } from "@/components/portal/EventChrome";
import { EventMarketing } from "@/components/portal/EventMarketing";
import { requirePortalEvent } from "@/lib/event-access";
import { getEventMarketing } from "@/lib/event-marketing";

export default async function PortalMarketingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { event } = await requirePortalEvent(id, "editor");
  const data = await getEventMarketing(id);

  return (
    <main className="portal-studio">
      <EventChrome event={event} current="marketing">
        <EventMarketing event={event} data={data} tab={query.tab ?? "codes"} />
      </EventChrome>
    </main>
  );
}
