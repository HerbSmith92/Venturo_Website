import { PORTAL_EVENTS_NEW } from "@/lib/portal";

export function CreateEventPrompt({ hasEvents }: { hasEvents: boolean }) {
  return (
    <section className="portal-create">
      <div className="colour-bar" aria-hidden="true" />
      <div className="portal-create-body">
        <div>
          <p className="eyebrow">Start Here</p>
          <h2>{hasEvents ? "Host Another Event" : "Create An Event"}</h2>
          <p className="muted">Name, date, tickets &amp; images. One step at a time.</p>
        </div>
        <a className="btn btn-primary" href={PORTAL_EVENTS_NEW}>
          + New Event
        </a>
      </div>
    </section>
  );
}
