"use client";

import { useState } from "react";

export function NewEventModal({
  open,
  onClose,
  stay,
}: {
  open: boolean;
  onClose: () => void;
  stay?: "portal";
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  async function createEvent(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, stay }),
      });
      const payload = (await response.json()) as { error?: string; redirect?: string };
      if (!response.ok || !payload.redirect) {
        throw new Error(payload.error ?? "Could not create event.");
      }
      window.location.href = payload.redirect;
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not create event.");
    }
  }

  return (
    <div className="studio-modal-wrap">
      <button type="button" className="studio-modal-backdrop" aria-label="Close" onClick={onClose} />
      <form className="studio-modal" onSubmit={(event) => void createEvent(event)}>
        <div className="studio-modal-head">
          <h2>New Event</h2>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
        <label className="field">
          <span>Event Name</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            autoFocus
            maxLength={120}
            placeholder="Mario Kart Night"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
          {pending ? "Please Wait" : "Create Event"}
        </button>
      </form>
    </div>
  );
}
