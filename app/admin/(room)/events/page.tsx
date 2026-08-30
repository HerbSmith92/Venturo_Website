import { listAdminEvents, type EventStatus } from "@/lib/events";
import { formatEventWhen } from "@/lib/events";

const FILTERS: { id: EventStatus | "all"; label: string }[] = [
  { id: "review", label: "In Review" },
  { id: "approved", label: "Live" },
  { id: "draft", label: "Draft" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = (FILTERS.some((f) => f.id === params.status)
    ? params.status
    : "review") as EventStatus | "all";
  const events = await listAdminEvents(status);

  return (
    <div className="cr-paper">
      <p className="eyebrow">Control Room</p>
      <h1>Events</h1>
      <p className="muted">Approve member-hosted events before they go public.</p>

      <div className="chips" style={{ margin: "24px 0" }}>
        {FILTERS.map((filter) => (
          <a
            key={filter.id}
            className={`chip${status === filter.id ? " active" : ""}`}
            href={`/admin/events?status=${filter.id}`}
          >
            {filter.label}
          </a>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="notice">Nothing in this queue.</p>
      ) : (
        <div className="stack-list">
          {events.map((event) => (
            <article key={event.id}>
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
      )}
    </div>
  );
}
