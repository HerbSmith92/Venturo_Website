import { EventChrome } from "@/components/portal/EventChrome";
import { saveHostFollowUp } from "@/app/event-followup-actions";
import { requirePortalEvent } from "@/lib/event-access";
import { loadHostReport } from "@/lib/event-followups";
import { formatWhen } from "@/lib/overview/metrics";

export default async function EventFollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { event } = await requirePortalEvent(id, "editor");
  const report = await loadHostReport(id);
  const ended = event.endsAt ? new Date(event.endsAt).getTime() < Date.now() : false;

  return (
    <main className="portal-studio">
      <EventChrome event={event} current="dashboard">
        <section>
          <p className="eyebrow">After the event</p>
          <h2>How Did It Go?</h2>
          <p className="lede muted">
            {ended
              ? `This event ended ${event.endsAt ? formatWhen(event.endsAt) : "already"}. Confirm it happened so we know the night was real.`
              : "This form opens once the event has ended."}
          </p>
          {query.error ? <p className="error">{query.error}</p> : null}
          {query.saved ? <p className="notice">Saved. Thank you.</p> : null}

          {ended ? (
            <form className="studio-card" action={saveHostFollowUp}>
              <input type="hidden" name="eventId" value={id} />
              <div className="field">
                <span>Did the event happen?</span>
                <label>
                  <input type="radio" name="happened" value="yes" defaultChecked={report?.happened !== false} required />
                  Yes, it happened
                </label>
                <label>
                  <input type="radio" name="happened" value="no" defaultChecked={report?.happened === false} />
                  No, it did not happen
                </label>
              </div>
              <label className="field">
                <span>How did it go?</span>
                <textarea name="note" rows={5} maxLength={2000} required defaultValue={report?.note ?? ""} />
              </label>
              <button className="btn btn-primary" type="submit">
                {report ? "Update report" : "Send report"}
              </button>
            </form>
          ) : (
            <p className="muted">Come back after {event.endsAt ? formatWhen(event.endsAt) : "the event"}.</p>
          )}
        </section>
      </EventChrome>
    </main>
  );
}
