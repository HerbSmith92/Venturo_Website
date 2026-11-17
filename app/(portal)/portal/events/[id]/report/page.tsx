import { EventChrome } from "@/components/portal/EventChrome";
import { requirePortalEvent } from "@/lib/event-access";
import { createServiceClient } from "@/lib/supabase/admin";

export default async function PortalEventReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event } = await requirePortalEvent(id);
  const service = createServiceClient();
  const { data: occurrences } = service
    ? await service.from("event_occurrences").select("id").eq("event_id", id)
    : { data: [] };
  const occurrenceIds = (occurrences ?? []).map((row) => row.id);
  const { data: report } =
    service && occurrenceIds.length
      ? await service
          .from("event_day_reports")
          .select("generated_at, timezone, confirmed_rsvps, valid_tickets, interested, expected_attendance")
          .in("occurrence_id", occurrenceIds)
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  return (
    <main className="portal-page">
      <EventChrome event={event} current="dashboard">
        <section className="studio-card">
          <p className="eyebrow">Event-day report</p>
          <h1>{event.title}</h1>
          {!report ? (
            <p className="notice">The event-day report has not been generated yet.</p>
          ) : (
            <>
              <p className="muted">
                Generated{" "}
                {new Date(report.generated_at).toLocaleString("en-ZA", {
                  timeZone: report.timezone,
                  hourCycle: "h23",
                })}{" "}
                ({report.timezone})
              </p>
              <div className="portal-stat-grid">
                <article className="portal-stat"><p className="eyebrow">Free RSVPs</p><strong>{report.confirmed_rsvps}</strong></article>
                <article className="portal-stat"><p className="eyebrow">Valid tickets</p><strong>{report.valid_tickets}</strong></article>
                <article className="portal-stat"><p className="eyebrow">Interested</p><strong>{report.interested}</strong></article>
                <article className="portal-stat"><p className="eyebrow">Expected attendance</p><strong>{report.expected_attendance}</strong></article>
              </div>
              <p style={{ marginTop: 24 }}>
                <a className="btn btn-primary" href={`/portal/events/${id}/door`}>Open live guest list</a>
              </p>
            </>
          )}
        </section>
      </EventChrome>
    </main>
  );
}
