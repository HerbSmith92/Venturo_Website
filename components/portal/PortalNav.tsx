"use client";

import { usePathname } from "next/navigation";
import { EventMenuNav } from "@/components/portal/EventMenuNav";
import { PORTAL_NAV, PORTAL_EVENTS, parsePortalEventPath } from "@/lib/portal";

export function PortalNav() {
  const path = usePathname();
  const eventPath = parsePortalEventPath(path);

  return (
    <nav className="portal-rail" aria-label="Event Host">
      <div className="colour-bar" aria-hidden="true" />
      <div className="portal-rail-links">
        {PORTAL_NAV.map((item) => {
          const isEvents = item.href === PORTAL_EVENTS;
          const listActive = isEvents && path === PORTAL_EVENTS;
          const branchOpen = isEvents && Boolean(eventPath);
          const active = isEvents ? listActive : path === item.href;

          if (isEvents) {
            return (
              <div
                key={item.href}
                className={`portal-rail-branch${branchOpen ? " open" : ""}`}
              >
                <a
                  className={
                    listActive || branchOpen
                      ? "portal-rail-link active"
                      : "portal-rail-link"
                  }
                  href={item.href}
                  aria-current={listActive ? "page" : undefined}
                  aria-expanded={branchOpen ? true : undefined}
                >
                  {item.label}
                </a>
                {eventPath ? (
                  <EventMenuNav eventId={eventPath.eventId} current={eventPath.section} />
                ) : null}
              </div>
            );
          }

          return (
            <a
              key={item.href}
              className={active ? "portal-rail-link active" : "portal-rail-link"}
              href={item.href}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
