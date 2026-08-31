"use client";

import { useState } from "react";
import type { EventStatus } from "@/lib/event-types";

export function EventActions({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: string) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/admin/events/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, action, note }),
    });
    const payload = (await response.json()) as { error?: string; ok?: boolean };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Action failed.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="stack-list">
      <label className="field">
        <span>Note (optional)</span>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="hero-actions">
        {status !== "approved" && (
          <button
            className="btn btn-primary"
            type="button"
            disabled={pending}
            onClick={() => run("approve")}
          >
            Approve & Publish
          </button>
        )}
        <button
          className="btn btn-secondary"
          type="button"
          disabled={pending}
          onClick={() => run("request_changes")}
        >
          Request Changes
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={pending}
          onClick={() => run("reject")}
        >
          Reject
        </button>
        {status === "approved" && (
          <button
            className="btn btn-secondary"
            type="button"
            disabled={pending}
            onClick={() => run("cancel")}
          >
            Cancel Event
          </button>
        )}
      </div>
    </div>
  );
}
