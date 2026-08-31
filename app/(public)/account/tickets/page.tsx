import { AccountNav } from "@/components/AccountNav";
import { getCurrentUser } from "@/lib/auth";
import { formatEventWhen } from "@/lib/events";
import { listBuyerTickets } from "@/lib/orders";
import { redirect } from "next/navigation";

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/tickets");

  const params = await searchParams;
  const tickets = await listBuyerTickets(user.id);

  return (
    <main className="shell">
      <section className="section">
        <AccountNav current="tickets" />
        <p className="eyebrow">Your Wallet</p>
        <h1>My Tickets</h1>
        {params.order && (
          <p className="notice">Tickets issued for your latest order. See you there.</p>
        )}
        {tickets.length === 0 ? (
          <p className="muted">
            No tickets yet.{" "}
            <a href="/events">Browse events</a> to grab a spot.
          </p>
        ) : (
          <div className="stack-list" style={{ marginTop: 28 }}>
            {tickets.map((ticket) => {
              const event = Array.isArray(ticket.events)
                ? ticket.events[0]
                : ticket.events;
              const type = Array.isArray(ticket.event_ticket_types)
                ? ticket.event_ticket_types[0]
                : ticket.event_ticket_types;
              return (
                <article key={ticket.id}>
                  <h2>{event?.title ?? "Event"}</h2>
                  <p className="muted">
                    {type?.name ?? "Ticket"} · Code <strong>{ticket.code}</strong>
                  </p>
                  {event?.starts_at && (
                    <p className="muted">
                      {formatEventWhen(event.starts_at, event.timezone ?? "Africa/Johannesburg")}
                      {event.venue_name ? ` · ${event.venue_name}` : ""}
                    </p>
                  )}
                  {event?.slug && (
                    <a className="btn btn-secondary" href={`/events/${event.slug}`}>
                      View Event
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
