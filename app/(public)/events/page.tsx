import { EventCard } from "@/components/EventCard";
import { getCurrentUser } from "@/lib/auth";
import { EVENT_CATEGORIES, listPublicEvents } from "@/lib/events";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category = params.category ?? "all";
  const user = await getCurrentUser();
  const events = await listPublicEvents({
    category: category === "all" ? undefined : category,
  });

  return (
    <main>
      <section className="shell">
        <div className="events-hero">
          <div className="colour-bar" aria-hidden="true" />
          <div className="events-hero-copy">
            <p className="eyebrow">Find Your Next Thrill</p>
            <h1>What&apos;s On Near You</h1>
            <p className="lede">
              Real plans with real people — markets, nights out, workshops, & the
              kind of quality time worth keeping. Book a ticket or host your own.
            </p>
            <div className="hero-actions">
              {user ? (
                <a className="btn btn-primary" href="/events/create">
                  Host An Adventure
                </a>
              ) : (
                <a className="btn btn-primary" href="/login?next=/events/create">
                  Log In To Host
                </a>
              )}
              <a className="btn btn-secondary" href="/directory">
                Taste The Directory
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">Around South Africa</p>
            <h2>Upcoming Adventures</h2>
          </div>
        </div>

        <div className="chips" style={{ marginBottom: 28 }}>
          <a
            className={`chip${category === "all" ? " active" : ""}`}
            href="/events"
          >
            All
          </a>
          {EVENT_CATEGORIES.map((item) => (
            <a
              key={item}
              className={`chip${category === item ? " active" : ""}`}
              href={`/events?category=${encodeURIComponent(item)}`}
            >
              {item}
            </a>
          ))}
        </div>

        {events.length === 0 ? (
          <div className="plan featured">
            <h3>The Calendar Is Warming Up</h3>
            <p className="muted">
              Be the curious local who posts the first plan. Member hosts go through
              a quick Control Room check — then you&apos;re live.
            </p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <a
                className="btn btn-primary"
                href={user ? "/events/create" : "/login?next=/events/create"}
              >
                Host An Adventure
              </a>
            </div>
          </div>
        ) : (
          <div className="grid">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                showMemberPrice={user?.plan === "paid"}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
