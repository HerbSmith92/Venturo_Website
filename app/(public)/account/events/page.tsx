import { getCurrentUser } from "@/lib/auth";
import {
  formatCents,
  formatEventWhen,
  getOrganiserSalesSummary,
  listOrganiserEvents,
} from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MyEventsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/events");

  const events = await listOrganiserEvents(user.id);
  const sales = await getOrganiserSalesSummary(user.id);
  const supabase = await createClient();
  const { data: payout } = supabase
    ? await supabase
        .from("organiser_payout_profiles")
        .select("bank_name, account_number_last4, account_holder")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <main className="shell">
      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Organiser</p>
            <h1>My Events</h1>
          </div>
          <a className="btn btn-primary" href="/events/create">
            Create Event
          </a>
        </div>

        <div className="grid" style={{ marginBottom: 32 }}>
          <article className="plan">
            <h2>{sales.ticketsSold}</h2>
            <p className="muted">Tickets sold</p>
          </article>
          <article className="plan">
            <h2>{formatCents(sales.grossCents)}</h2>
            <p className="muted">Gross ticket sales</p>
          </article>
          <article className="plan">
            <h2>{formatCents(sales.feesCents)}</h2>
            <p className="muted">Platform fees</p>
          </article>
          <article className="plan featured">
            <h2>{formatCents(sales.owedCents)}</h2>
            <p className="muted">Owed for payout</p>
          </article>
        </div>

        {payout && (
          <p className="notice">
            Payout profile: {payout.account_holder} · {payout.bank_name} · ****
            {payout.account_number_last4}
          </p>
        )}

        {events.length === 0 ? (
          <p className="muted">You haven&apos;t created an event yet.</p>
        ) : (
          <div className="stack-list">
            {events.map((event) => (
              <article key={event.id}>
                <div className="section-head" style={{ marginBottom: 0 }}>
                  <div>
                    <span className={`status-pill ${event.status}`}>{event.status}</span>
                    <h2 style={{ marginTop: 10 }}>{event.title}</h2>
                    <p className="muted">
                      {formatEventWhen(event.startsAt, event.timezone)}
                      {event.city ? ` · ${event.city}` : ""}
                    </p>
                  </div>
                  <a className="btn btn-secondary" href={`/events/${event.slug}`}>
                    Open
                  </a>
                </div>
                {event.reviewNote && (
                  <p className="notice" style={{ marginTop: 12 }}>
                    Staff note: {event.reviewNote}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
