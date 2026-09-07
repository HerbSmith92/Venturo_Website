import { AccountNav } from "@/components/AccountNav";
import { HostEventsHeader } from "@/components/events/HostEventsHeader";
import { getCurrentUser } from "@/lib/auth";
import {
  eventFeedImage,
  formatCents,
  formatEventWindow,
  getOrganiserSalesSummary,
  listOrganiserEvents,
} from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MyEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ when?: string; new?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    const next =
      params.new === "1" ? "/account/events%3Fnew%3D1" : "/account/events";
    redirect(`/login?next=${next}`);
  }
  const when = params.when === "past" ? "past" : "current";
  const events = await listOrganiserEvents(user.id);
  const now = Date.now();
  const filtered = events.filter((event) => {
    const end = event.endsAt ? new Date(event.endsAt).getTime() : null;
    const isPast = end !== null && end < now;
    return when === "past" ? isPast : !isPast;
  });
  const currentCount = events.filter((event) => {
    const end = event.endsAt ? new Date(event.endsAt).getTime() : null;
    return !(end !== null && end < now);
  }).length;
  const pastCount = events.length - currentCount;
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
        <AccountNav current="events" />
        <div className="studio-top host-events-head">
          <div>
            <p className="eyebrow">Organiser</p>
            <h1>Events</h1>
          </div>
          <div className="host-events-tools">
            <div className="chips">
              <a
                className={`chip${when === "current" ? " active" : ""}`}
                href="/account/events?when=current"
              >
                Current ({currentCount})
              </a>
              <a
                className={`chip${when === "past" ? " active" : ""}`}
                href="/account/events?when=past"
              >
                Past ({pastCount})
              </a>
            </div>
            <HostEventsHeader startOpen={params.new === "1"} />
          </div>
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
            Payout bank: {payout.account_holder} · {payout.bank_name} · ****
            {payout.account_number_last4}. Change it in{" "}
            <a href="/portal/settings?tab=bank">Host Settings</a>.
          </p>
        )}

        {filtered.length === 0 ? (
          <p className="muted">
            {when === "past"
              ? "No past events yet."
              : "No current events. Tap New Event to start with a name."}
          </p>
        ) : (
          <div className="host-event-list">
            {filtered.map((event) => (
              <a className="host-event-row" key={event.id} href={`/account/events/${event.id}`}>
                <img src={eventFeedImage(event)} alt="" />
                <div>
                  <h2>{event.title}</h2>
                  <p className="muted">
                    {formatEventWindow(event.startsAt, event.endsAt, event.timezone)}
                    {event.venueName ? ` · ${event.venueName}` : ""}
                  </p>
                </div>
                <span className={`status-pill ${event.status}`}>
                  {event.status === "approved" ? "live" : event.status}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
