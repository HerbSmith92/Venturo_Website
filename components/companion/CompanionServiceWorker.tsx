"use client";

import { useEffect } from "react";

export function CompanionServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/companion-sw.js", { scope: "/companion" });
  }, []);
  return null;
}
