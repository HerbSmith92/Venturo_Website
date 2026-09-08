"use client";

import { useEffect } from "react";

export function EventViewBeacon({
  eventId,
  campaignSlug,
  skip = false,
}: {
  eventId: string;
  campaignSlug?: string | null;
  skip?: boolean;
}) {
  useEffect(() => {
    if (skip) return;
    const url = campaignSlug
      ? `/api/events/${eventId}/view?c=${encodeURIComponent(campaignSlug)}`
      : `/api/events/${eventId}/view`;
    const key = campaignSlug
      ? `venturo-event-view:${eventId}:c:${campaignSlug}`
      : `venturo-event-view:${eventId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode can block storage; still count this visit.
    }
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
      return;
    }
    void fetch(url, { method: "POST", keepalive: true });
  }, [eventId, campaignSlug, skip]);

  return null;
}
