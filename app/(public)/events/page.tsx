import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { getCurrentUser } from "@/lib/auth";
import { EVENT_CATEGORIES, listPublicEvents } from "@/lib/events";
import { EVENT_HOST } from "@/lib/portal";

export const metadata: Metadata = {
  title: "What's On · Venturo",
  description: "Upcoming Venturo adventures near you.",
};

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
              Real plans with real people—markets, nights out, workshops, &amp;
              the kind of quality time worth keeping.
            </p>
            <div className="hero-actions">
              <a className="btn btn-secondary" href={EVENT_HOST}>
                Event Host
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
          <a className={`chip${category === "all" ? " active" : ""}`} href="/events">
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
          <div className="plan">
            <h3>The Calendar Is Warming Up</h3>
            <p className="muted">
              Be the curious local who posts the first plan. Hosting lives in
              Event Host.
            </p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <a className="btn btn-primary" href={EVENT_HOST}>
                Event Host
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
