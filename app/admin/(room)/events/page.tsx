import { bulkEventAction } from "@/app/admin/bulk-actions";
import { BulkForm } from "@/components/admin/BulkForm";
import { listAdminEvents, type EventStatus } from "@/lib/events";
import { formatEventWhen } from "@/lib/events";

const FILTERS: { id: EventStatus | "all"; label: string }[] = [
  { id: "review", label: "In Review" },
  { id: "approved", label: "Live" },
  { id: "draft", label: "Draft" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const params = await searchParams;
  const status = (FILTERS.some((f) => f.id === params.status)
    ? params.status
    : "review") as EventStatus | "all";
  const events = await listAdminEvents(status);
  const returnTo = `/admin/events?status=${status}`;

  const list = (
    <div className="stack-list">
      {events.map((event) => (
        <article key={event.id} className="cr-bulk-row">
          <input
            className="cr-bulk-check"
            type="checkbox"
            name="id"
            value={event.id}
            form="bulk-events"
            aria-label={`Select ${event.title}`}
          />
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <span className={`status-pill ${event.status}`}>{event.status}</span>
              <h2 style={{ marginTop: 8 }}>{event.title}</h2>
              <p className="muted">
                {formatEventWhen(event.startsAt, event.timezone)}
                {event.category ? ` · ${event.category}` : ""}
              </p>
            </div>
            <a className="btn btn-primary" href={`/admin/events/${event.id}`}>
              Review
            </a>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <div className="cr-paper">
      <p className="eyebrow">Control Room</p>
      <h1>Events</h1>
      <p className="muted">Approve member-hosted events before they go public.</p>
      {params.error ? <p className="error">{params.error}</p> : null}

      {events.length === 0 ? (
        <p className="notice">
          {status === "review"
            ? "Nothing waiting. Host submissions land here. Published events are under Live."
            : "Nothing in this queue."}
        </p>
      ) : (
        <BulkForm formId="bulk-events" noun="Event" nouns="Events" action={bulkEventAction} returnTo={returnTo}>
          {list}
        </BulkForm>
      )}
    </div>
  );
}
