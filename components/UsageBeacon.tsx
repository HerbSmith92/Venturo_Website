"use client";

import { useEffect } from "react";
import type { UsageKind } from "@/lib/member-usage";

function send(kind: UsageKind) {
  const body = JSON.stringify({ kind, platform: "web" });
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/activity", blob);
    return;
  }
  void fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

/** Fires once per browser session when a signed-in member scrolls or opens a record. */
export function UsageBeacon({ kind }: { kind: UsageKind }) {
  useEffect(() => {
    const key = `venturo-use:${kind}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // Private mode can block storage. The server still keeps one row per day.
    }

    const mark = () => {
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        // Ignore storage failures and still record this use.
      }
      send(kind);
    };

    if (kind !== "scroll") {
      mark();
      return;
    }

    const onScroll = () => {
      if (window.scrollY < 80 && document.documentElement.scrollTop < 80) return;
      window.removeEventListener("scroll", onScroll);
      mark();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [kind]);

  return null;
}
