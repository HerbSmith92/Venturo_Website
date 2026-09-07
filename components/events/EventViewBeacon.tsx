"use client";

import { useEffect } from "react";

export function EventViewBeacon({ eventId, skip = false }: { eventId: string; skip?: boolean }) {
  useEffect(() => {
    if (skip) return;
    const key = `venturo-event-view:${eventId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode can block storage; still count this visit.
    }
    const url = `/api/events/${eventId}/view`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
      return;
    }
    void fetch(url, { method: "POST", keepalive: true });
  }, [eventId, skip]);

  return null;
}
