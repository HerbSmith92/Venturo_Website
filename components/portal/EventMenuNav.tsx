import {
  EVENT_MENU_ITEMS,
  portalDoorHref,
  portalEventHref,
  portalEventSectionHref,
  type EventMenuSection,
} from "@/lib/portal";

export function EventMenuNav({
  eventId,
  current,
}: {
  eventId: string;
  current: EventMenuSection;
}) {
  return (
    <div className="portal-rail-sub" aria-label="Event Menu">
      <a
        className={current === "menu" ? "portal-rail-link nested active" : "portal-rail-link nested"}
        href={portalEventHref(eventId)}
        aria-current={current === "menu" ? "page" : undefined}
      >
        Menu
      </a>
      {EVENT_MENU_ITEMS.map((item) => (
        <a
          key={item.id}
          className={
            current === item.id ? "portal-rail-link nested active" : "portal-rail-link nested"
          }
          href={portalEventSectionHref(eventId, item.slug)}
          aria-current={current === item.id ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
      <a
        className={current === "door" ? "portal-rail-link nested active" : "portal-rail-link nested"}
        href={portalDoorHref(eventId)}
        aria-current={current === "door" ? "page" : undefined}
      >
        Door
      </a>
    </div>
  );
}
