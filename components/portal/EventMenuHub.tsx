import { EVENT_MENU_ITEMS, portalEventSectionHref } from "@/lib/portal";
import type { VenturoEvent } from "@/lib/event-types";

function statusLabel(status: VenturoEvent["status"]) {
  if (status === "approved") return "Live";
  if (status === "review") return "In Review";
  if (status === "draft") return "Draft";
  if (status === "cancelled") return "Cancelled";
  return status;
}

export function EventMenuHub({ event }: { event: VenturoEvent }) {
  return (
    <section className="event-menu-hub">
      <div className="event-menu-hub-head">
        <p className="eyebrow">Event Menu</p>
        <h2>What Do You Need</h2>
        <p className="lede muted">
          Dashboard first. Then checkout, guests, marketing &amp; the rest—without leaving this
          event.
        </p>
        <span className={`status-pill ${event.status}`}>{statusLabel(event.status)}</span>
      </div>
      <div className="event-menu-grid">
        {EVENT_MENU_ITEMS.map((item) => (
          <a
            key={item.id}
            className="event-menu-card"
            href={portalEventSectionHref(event.id, item.slug)}
          >
            <h3>{item.label}</h3>
            <p className="muted">{item.lede}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
