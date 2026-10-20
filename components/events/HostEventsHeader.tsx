import { PORTAL_EVENTS_NEW } from "@/lib/portal";

export function HostEventsHeader() {
  return (
    <a className="btn btn-primary" href={PORTAL_EVENTS_NEW}>
      + New Event
    </a>
  );
}
