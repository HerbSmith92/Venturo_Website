"use client";

import { useState } from "react";

export function AnalyticsRefreshButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/analytics/refresh", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not refresh.");
      window.location.reload();
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not refresh.");
    }
  }

  return (
    <div>
      <button className="btn btn-secondary" type="button" disabled={pending} onClick={() => void refresh()}>
        {pending ? "Pulling" : "Pull Store & RevenueCat"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
