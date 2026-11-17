"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const PULSE_MS = 30_000;

function ping(
  name: "page_view" | "active_time" | "click",
  path: string,
  options: { seconds?: number; properties?: Record<string, string>; attribution?: boolean } = {},
) {
  const params = new URLSearchParams(window.location.search);
  const body = JSON.stringify({
    name,
    path,
    seconds: options.seconds,
    properties: options.properties,
    ...(options.attribution
      ? {
          referrer: document.referrer,
          source: params.get("utm_source"),
          medium: params.get("utm_medium"),
          campaign: params.get("utm_campaign"),
        }
      : {}),
  });
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
    let activeSince = document.visibilityState === "visible" ? Date.now() : null;
    let unsentSeconds = 0;
    ping("page_view", path, { attribution: true });

    const captureActiveTime = () => {
      if (activeSince !== null) {
        unsentSeconds += Math.max(0, Math.round((Date.now() - activeSince) / 1000));
        activeSince = null;
      }
    };
    const flushActiveTime = () => {
      captureActiveTime();
      if (unsentSeconds > 0) {
        ping("active_time", path, { seconds: unsentSeconds });
        unsentSeconds = 0;
      }
      if (document.visibilityState === "visible") activeSince = Date.now();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") flushActiveTime();
      else if (activeSince === null) activeSince = Date.now();
    };
    const click = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest("a,button");
      if (!target) return;
      const href = target instanceof HTMLAnchorElement ? target.getAttribute("href") ?? "" : "";
      ping("click", path, {
        properties: {
          target_type: target.tagName.toLowerCase(),
          target_path: href.startsWith("/") ? href.slice(0, 200) : href.startsWith("http") ? "external" : "",
        },
      });
    };

    const timer = window.setInterval(flushActiveTime, PULSE_MS);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("click", click, { capture: true });
    window.addEventListener("pagehide", flushActiveTime);
    return () => {
      flushActiveTime();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("click", click, { capture: true });
      window.removeEventListener("pagehide", flushActiveTime);
    };
  }, [path]);

  return null;
}
