import {
  EVENT_MENU_ITEMS,
  portalEventSectionHref,
  type EventMenuSection,
} from "@/lib/portal";
import { companionEventHref } from "@/lib/companion";

export function EventMenuNav({
  eventId,
  current,
}: {
  eventId: string;
  current: EventMenuSection;
}) {
  return (
    <div className="portal-rail-sub" aria-label="Event Menu">
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
        href={companionEventHref(eventId)}
        aria-current={current === "door" ? "page" : undefined}
      >
        Door
      </a>
    </div>
  );
}
