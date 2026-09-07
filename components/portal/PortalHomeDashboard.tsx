import { CreateEventPrompt } from "@/components/portal/CreateEventPrompt";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { formatCents, formatEventWindow } from "@/lib/events";
import { portalDoorHref, portalEventHref } from "@/lib/portal";
import {
  PORTAL_RANGE_LABELS,
  PORTAL_RANGES,
  type EventHomeSeries,
  type PortalHomeData,
} from "@/lib/portal-home";

function formatCount(n: number) {
  return new Intl.NumberFormat("en-ZA").format(n);
}

function formatRate(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  if (n >= 100) return "100%";
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(2)}%`;
}

function statusLabel(status: EventHomeSeries["event"]["status"]) {
  if (status === "approved") return "Live";
  if (status === "review") return "In Review";
  if (status === "draft") return "Draft";
  return status;
}

function EventBlock({ row }: { row: EventHomeSeries }) {
  const { event } = row;
  const when = formatEventWindow(event.startsAt, event.endsAt, event.timezone);

  return (
    <article className="portal-event">
      <div className="portal-event-copy">
        <a href={portalEventHref(event.id)}>
          <h3>{event.title}</h3>
          <p className="muted">
            {when}
            {event.venueName ? ` · ${event.venueName}` : ""}
          </p>
        </a>
        {event.status === "approved" && (
          <a className="btn btn-primary portal-door-btn" href={portalDoorHref(event.id)}>
            Open Door
          </a>
        )}
      </div>
      <span className={`status-pill ${event.status}`}>{statusLabel(event.status)}</span>
      <details className="portal-event-fold" open>
        <summary className="portal-event-toggle" aria-label={`${event.title}. Toggle graphs.`}>
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="portal-event-graphs">
        <PortalBarChart
          label="Viewed"
          summary={formatCount(row.viewed)}
          points={row.viewedSeries}
          color="var(--sapphire)"
        />
        <PortalBarChart
          label="Sold"
          summary={formatCount(row.sold)}
          stat={{ label: "Conversion", value: formatRate(row.conversion) }}
          points={row.soldSeries}
          color="var(--jade)"
        />
        <PortalBarChart
          label="Revenue (R)"
          summary={formatCents(row.revenueCents)}
          points={row.revenueSeries}
          color="var(--canary)"
          kind="rand"
        />
      </div>
      </details>
    </article>
  );
}

export function PortalHomeDashboard({
  firstName,
  data,
}: {
  firstName: string;
  data: PortalHomeData;
}) {
  return (
    <main className="portal-home">
      <p className="eyebrow">Event Host</p>
      <h1>Home, {firstName}</h1>
      <p className="lede muted">Tickets, views &amp; revenue for the window you pick.</p>

      <CreateEventPrompt hasEvents={data.events.length > 0} />

      <section className="portal-totals">
        <div className="portal-totals-head">
          <div>
            <p className="eyebrow">Totals</p>
            <h2>How You&apos;re Tracking</h2>
          </div>
          <div className="portal-range" role="navigation" aria-label="Totals window">
            {PORTAL_RANGES.map((range) => (
              <a
                key={range}
                className={range === data.range ? "on" : undefined}
                href={`/portal?range=${range}`}
                aria-current={range === data.range ? "page" : undefined}
              >
                {PORTAL_RANGE_LABELS[range]}
              </a>
            ))}
          </div>
        </div>
        <div className="portal-stat-grid">
          <article className="portal-stat">
            <p className="eyebrow">Tickets Sold</p>
            <strong>{formatCount(data.ticketsSold)}</strong>
          </article>
          <article className="portal-stat">
            <p className="eyebrow">Total Event Views</p>
            <strong>{formatCount(data.views)}</strong>
          </article>
          <article className="portal-stat">
            <p className="eyebrow">Total Revenue</p>
            <strong>{formatCents(data.revenueCents)}</strong>
          </article>
        </div>
      </section>

      <section className="portal-active">
        <p className="eyebrow">On The Go</p>
        <h2>Active Events</h2>
        {data.events.length === 0 ? (
          <p className="muted">None hosted yet. Create one above &amp; it lands here.</p>
        ) : (
          <div className="portal-event-list">
            {data.events.map((row) => (
              <EventBlock key={row.event.id} row={row} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
