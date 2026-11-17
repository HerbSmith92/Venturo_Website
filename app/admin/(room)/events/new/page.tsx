import { createExternalEvent, createVenturoEvent } from "@/app/admin/event-actions";
import { requireStaff } from "@/lib/auth";

export default async function AdminCreateEventPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; error?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const external = params.kind === "external";

  return (
    <section>
      <p className="eyebrow">Control Room</p>
      <h1>{external ? "Add external event" : "Add event"}</h1>
      <p className="muted">
        {external
          ? "List a third-party event. Booking stays on Quicket, Howler or the organiser’s site."
          : "Create a Venturo-hosted event (ticketing or free RSVP) or an external listing."}
      </p>
      {params.error ? <p className="error">{params.error}</p> : null}

      {!external ? (
        <div className="portal-stat-grid" style={{ marginTop: 28 }}>
          <article className="studio-card">
            <p className="eyebrow">Venturo event</p>
            <h2>Internal</h2>
            <p className="muted">
              Free RSVP or Venturo Ticketing. You can switch the booking method while you edit.
            </p>
            <form action={createVenturoEvent} style={{ marginTop: 20 }}>
              <button className="btn btn-primary" type="submit">
                Create Venturo event
              </button>
            </form>
          </article>
          <article className="studio-card">
            <p className="eyebrow">Third party</p>
            <h2>External booking</h2>
            <p className="muted">
              Discover on Venturo. Book now opens the provider site. No Venturo checkout or payout.
            </p>
            <p style={{ marginTop: 20 }}>
              <a className="btn btn-primary" href="/admin/events/new?kind=external">
                Create external event
              </a>
            </p>
          </article>
        </div>
      ) : (
        <form action={createExternalEvent} className="studio-card" style={{ marginTop: 28, maxWidth: 640 }}>
          <label className="field">
            <span>Event name</span>
            <input name="title" required placeholder="Blink-182 tribute · Johannesburg" />
          </label>
          <label className="field">
            <span>Organiser</span>
            <input
              name="organiserDisplayName"
              required
              placeholder="The business or community running this event"
            />
          </label>
          <label className="field">
            <span>Booking provider</span>
            <input name="externalProviderName" required placeholder="Quicket, Howler…" />
          </label>
          <label className="field">
            <span>External booking URL</span>
            <input
              name="externalBookingUrl"
              type="url"
              required
              placeholder="https://www.quicket.co.za/events/…"
            />
          </label>
          <label className="field">
            <span>Button label</span>
            <input name="externalBookingButtonLabel" placeholder="Book now" defaultValue="Book now" />
          </label>
          <p className="muted">
            Next you’ll add dates, venue, images &amp; copy. Book now opens this link in a new tab.
          </p>
          <div className="hero-actions" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" type="submit">
              Continue to editor
            </button>
            <a className="btn btn-secondary" href="/admin/events/new">
              Back
            </a>
          </div>
        </form>
      )}
    </section>
  );
}
