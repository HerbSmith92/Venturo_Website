import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { getCurrentUser } from "@/lib/auth";
import { EVENT_CATEGORIES, listPublicEvents } from "@/lib/events";
import { eventCategoryChipInk, eventCategoryColour } from "@/lib/event-style";
import { COLORS } from "@/lib/brand";
import { EVENT_HOST, PORTAL_EVENTS_NEW } from "@/lib/portal";

export const metadata: Metadata = {
  title: "What's On · Venturo",
  description: "Upcoming Venturo adventures near you.",
};

function chipStyle(fill: string, active: boolean) {
  return {
    background: fill,
    color: eventCategoryChipInk(fill),
    outline: active ? `2px solid ${COLORS.canary}` : "none",
    outlineOffset: "2px",
  };
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; when?: string; price?: string; q?: string }>;
}) {
  const params = await searchParams;
  const category = params.category ?? "all";
  const when =
    params.when === "weekend" || params.when === "past" || params.when === "calendar"
      ? params.when
      : "upcoming";
  const price = params.price === "free" || params.price === "paid" ? params.price : "";
  const needle = (params.q ?? "").trim().toLowerCase();
  const user = await getCurrentUser();
  const listed = await listPublicEvents({
    category: category === "all" ? undefined : category,
    when: when === "calendar" ? "upcoming" : when,
    price: price || undefined,
    expandRepeats: true,
  });
  const events = listed.filter((event) => {
    if (!needle) return true;
    return `${event.title} ${event.city ?? ""} ${event.category ?? ""}`.toLowerCase().includes(needle);
  });
  const showRows = when === "upcoming" && category === "all" && !needle && !price;
  const comingUp = events.slice(0, 6);
  const hot = events
    .filter(
      (event) =>
        event.memberFromPriceCents !== null &&
        (event.fromPriceCents === null || event.memberFromPriceCents < event.fromPriceCents),
    )
    .slice(0, 6);

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
              <a
                className="btn btn-secondary"
                href={user ? PORTAL_EVENTS_NEW : `/login?next=${encodeURIComponent(PORTAL_EVENTS_NEW)}`}
              >
                Create An Event
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section shell">
        <form className="field" method="get" action="/events">
          <span>Search events</span>
          <input name="q" defaultValue={params.q ?? ""} placeholder="Name, place, or category" />
          {when !== "upcoming" ? <input type="hidden" name="when" value={when} /> : null}
          {category !== "all" ? <input type="hidden" name="category" value={category} /> : null}
          {price ? <input type="hidden" name="price" value={price} /> : null}
        </form>
        <div className="section-head">
          <div>
            <p className="eyebrow">Around South Africa</p>
            <h2>
              {when === "past" ? "Past Events" : when === "weekend" ? "This Weekend" : "Upcoming Adventures"}
            </h2>
          </div>
        </div>

        <div className="chips" style={{ marginBottom: 16 }}>
          {(
            [
              ["upcoming", "Upcoming"],
              ["weekend", "This Weekend"],
              ["past", "Past"],
            ] as const
          ).map(([id, label]) => (
            <a
              key={id}
              className={`chip${when === id ? " active" : ""}`}
              href={`/events?when=${id}${category !== "all" ? `&category=${encodeURIComponent(category)}` : ""}${price ? `&price=${price}` : ""}`}
            >
              {label}
            </a>
          ))}
          <a
            className={`chip${price === "free" ? " active" : ""}`}
            href={`/events?when=${when}&price=free${category !== "all" ? `&category=${encodeURIComponent(category)}` : ""}`}
          >
            Free
          </a>
          <a
            className={`chip${price === "paid" ? " active" : ""}`}
            href={`/events?when=${when}&price=paid${category !== "all" ? `&category=${encodeURIComponent(category)}` : ""}`}
          >
            Paid
          </a>
          <a className={`chip${when === "calendar" ? " active" : ""}`} href="/events?when=calendar">
            Calendar
          </a>
        </div>

        <div className="chips events-interest-chips" style={{ marginBottom: 28 }} role="list">
          <a
            className={`chip chip-light${category === "all" ? " active" : ""}`}
            href="/events"
            aria-current={category === "all" ? "page" : undefined}
            style={chipStyle(COLORS.sapphire, category === "all")}
          >
            All
          </a>
          {EVENT_CATEGORIES.map((item) => {
            const fill = eventCategoryColour(item);
            const on = category === item;
            return (
              <a
                key={item}
                className={`chip chip-light${on ? " active" : ""}`}
                href={`/events?category=${encodeURIComponent(item)}`}
                aria-current={on ? "page" : undefined}
                style={chipStyle(fill, on)}
              >
                {item}
              </a>
            );
          })}
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
        ) : when === "calendar" ? (
          <div className="stack-list">
            {Array.from(
              events.reduce((map, event) => {
                const day = event.startsAt
                  ? new Intl.DateTimeFormat("en-ZA", {
                      timeZone: event.timezone || "Africa/Johannesburg",
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(event.startsAt))
                  : "Date to be confirmed";
                const list = map.get(day) ?? [];
                list.push(event);
                map.set(day, list);
                return map;
              }, new Map<string, typeof events>()),
            ).map(([day, dayEvents]) => (
              <section key={day}>
                <h3>{day}</h3>
                <div className="grid">
                  {dayEvents.map((event) => (
                    <EventCard
                      key={`${event.id}-${event.startsAt}`}
                      event={event}
                      showMemberPrice={user?.plan === "paid"}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : showRows ? (
          <>
            <div className="discover-row">
              <h2>Coming up</h2>
              <div className="grid">
                {comingUp.map((event) => (
                  <EventCard key={`${event.id}-${event.startsAt}`} event={event} showMemberPrice={user?.plan === "paid"} />
                ))}
              </div>
            </div>
            {hot.length > 0 ? (
              <div className="discover-row">
                <h2>Hot on Venturo</h2>
                <div className="grid">
                  {hot.map((event) => (
                    <EventCard key={`hot-${event.id}-${event.startsAt}`} event={event} showMemberPrice={user?.plan === "paid"} />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid">
            {events.map((event) => (
              <EventCard
                key={`${event.id}-${event.startsAt}`}
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
