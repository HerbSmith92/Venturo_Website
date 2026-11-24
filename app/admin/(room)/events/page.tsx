import { bulkEventAction } from "@/app/admin/bulk-actions";
import { BulkForm } from "@/components/admin/BulkForm";
import { loadEventHosts } from "@/lib/event-host";
import { listAdminEvents, type EventStatus } from "@/lib/events";
import { formatEventWhen } from "@/lib/events";

const FILTERS: { id: EventStatus | "all" | "changes"; label: string }[] = [
  { id: "review", label: "In Review" },
  { id: "approved", label: "Live" },
  { id: "changes", label: "Changes requested" },
  { id: "draft", label: "Drafts" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; flag?: string }>;
}) {
  const params = await searchParams;
  const status = (FILTERS.some((f) => f.id === params.status)
    ? params.status
    : "review") as EventStatus | "all" | "changes";
  const flag = params.flag === "unassigned-setting" || params.flag === "missing-energy" ? params.flag : "";
  let events = await listAdminEvents(status);
  if (flag === "unassigned-setting") {
    events = events.filter((event) => !event.indoorOutdoor);
  } else if (flag === "missing-energy") {
    events = events.filter((event) => !event.format?.trim());
  }
  const hosts = await loadEventHosts(
    events.map((event) => event.organiserId),
    { withAuthEmail: false },
  );
  const returnTo = `/admin/events?status=${status}${flag ? `&flag=${flag}` : ""}`;

  const list = (
    <div className="stack-list">
      {events.map((event) => {
        const host = hosts.get(event.organiserId);
        const hostLine = host
          ? `${host.name}${host.email || host.phone ? ` · ${host.email || host.phone}` : ""}`
          : "No host named";
        return (
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
                {` · ${hostLine}`}
              </p>
            </div>
            <a className="btn btn-primary" href={`/admin/events/${event.id}`}>
              Review
            </a>
          </div>
        </article>
        );
      })}
    </div>
  );

  return (
    <section>
      <p className="eyebrow">Control Room</p>
      <h1>Events</h1>
      <p className="muted">
        Create Venturo or external third-party events, then approve them before they go public.
      </p>
      <p className="hero-actions" style={{ marginTop: 16 }}>
        <a className="btn btn-primary" href="/admin/events/new">
          Add event
        </a>
        <a className="btn btn-secondary" href="/admin/events/new?kind=external">
          Add external event
        </a>
        <a className="btn btn-ghost" href={`/admin/events?status=${status}&flag=unassigned-setting`}>
          Unassigned setting
        </a>
        <a className="btn btn-ghost" href={`/admin/events?status=${status}&flag=missing-energy`}>
          Missing energy
        </a>
        {flag ? (
          <a className="btn btn-ghost" href={`/admin/events?status=${status}`}>
            Clear flag
          </a>
        ) : null}
      </p>
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
    </section>
  );
}
