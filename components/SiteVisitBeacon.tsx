"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function ping(kind: "view" | "pulse") {
  const body = JSON.stringify({ kind });
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/visit", blob);
    return;
  }
  void fetch("/api/analytics/visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

export function SiteVisitBeacon() {
  const path = usePathname();

  useEffect(() => {
    const key = `venturo-site-view:${path}`;
    let counted = false;
    try {
      counted = Boolean(sessionStorage.getItem(key));
      if (!counted) sessionStorage.setItem(key, "1");
    } catch {
      counted = false;
    }
    ping(counted ? "pulse" : "view");

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") ping("pulse");
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [path]);

  return null;
}
