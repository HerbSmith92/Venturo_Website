"use client";

import { useEffect, useMemo, useState } from "react";
import { CompanionInstallHint } from "@/components/companion/CompanionInstallHint";
import { EventCard } from "@/components/EventCard";
import { companionEventHref } from "@/lib/companion";
import type { CompanionEventCard } from "@/lib/companion-data";
import { loadCompanionEvents, saveCompanionEvents } from "@/lib/companion-offline";

function statusLabel(status: CompanionEventCard["status"]) {
  if (status === "approved") return "Live";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function cardEvent(event: CompanionEventCard) {
  return {
    slug: event.id,
    title: event.title,
    category: event.category ?? null,
    audienceGender: event.audienceGender || "Everyone",
    startsAt: event.startsAt,
    timezone: event.timezone,
    city: event.city,
    listingImageUrl: event.imageUrl,
    bannerUrl: null,
    storyImageUrl: null,
    fromPriceCents: event.fromPriceCents ?? null,
    memberFromPriceCents: event.memberFromPriceCents ?? null,
    membersOnly: Boolean(event.membersOnly),
  };
}

export function CompanionEvents({ initialEvents }: { initialEvents: CompanionEventCard[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (initialEvents.length) {
      void saveCompanionEvents(initialEvents);
      return;
    }
    void loadCompanionEvents().then((cached) => {
      if (cached.length) {
        setEvents(cached);
        setFromCache(true);
      }
    });
  }, [initialEvents]);

  async function refresh() {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/host/events");
      const payload = (await response.json()) as { events?: CompanionEventCard[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not refresh events.");
      const next = payload.events ?? [];
      setEvents(next);
      setFromCache(false);
      await saveCompanionEvents(next);
    } catch (err) {
      const cached = await loadCompanionEvents();
      if (cached.length) {
        setEvents(cached);
        setFromCache(true);
      }
      setError(err instanceof Error ? err.message : "Could not refresh events.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!online) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first online refresh
  }, [online]);

  const emptyCopy = useMemo(() => {
    if (events.length) return null;
    return online
      ? "No live events yet. The door unlocks when Control Room publishes."
      : "No saved events on this phone. Connect once to pull your list.";
  }, [events.length, online]);

  return (
    <div className="companion-home">
      <div className="companion-section-head">
        <h2>Your Events</h2>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void refresh()}
          disabled={syncing || !online}
        >
          {syncing ? "Syncing…" : "Sync"}
        </button>
      </div>
      {fromCache && <p className="companion-cache">Saved on this phone</p>}

      {error && !events.length && <p className="companion-flash bad">{error}</p>}

      {emptyCopy ? (
        <p className="muted companion-empty">{emptyCopy}</p>
      ) : (
        <ul className="companion-event-scroller">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard
                event={cardEvent(event)}
                href={companionEventHref(event.id)}
                showMemberPrice
                imageBadge={
                  event.status !== "approved" ? (
                    <span className={`card-status-badge ${event.status}`}>
                      {statusLabel(event.status)}
                    </span>
                  ) : undefined
                }
              >
                {event.stats ? (
                  <p className="card-meta">
                    {event.stats.scannedGuests} scanned · {event.stats.remainingGuests} still to
                    come
                  </p>
                ) : null}
              </EventCard>
            </li>
          ))}
        </ul>
      )}

      <CompanionInstallHint />
    </div>
  );
}
