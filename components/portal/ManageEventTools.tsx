"use client";

import { useState } from "react";
import type { EventCollaborator } from "@/lib/event-collaborators";
import { isoToDatetimeLocal } from "@/lib/event-types";
import type { VenturoEvent } from "@/lib/event-types";

export function ManageEventTools({
  event,
  canEdit,
  isOwner,
  collaborators,
  actorEmail,
}: {
  event: VenturoEvent;
  canEdit: boolean;
  isOwner: boolean;
  collaborators: EventCollaborator[];
  actorEmail: string;
}) {
  const [startsAt, setStartsAt] = useState(isoToDatetimeLocal(event.startsAt));
  const [endsAt, setEndsAt] = useState(isoToDatetimeLocal(event.endsAt));
  const [refund, setRefund] = useState<"none" | "requested">("none");
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<"editor" | "door">("editor");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function run(action: string, extra?: Record<string, unknown>) {
    setPending(action);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/host/events/${event.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const payload = (await response.json()) as {
        error?: string;
        redirect?: string;
        notice?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "That did not work.");
      if (payload.redirect) {
        window.location.href = payload.redirect;
        return;
      }
      setNotice(payload.notice ?? "Done.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.");
      setPending(null);
    }
  }

  async function addPerson(submit: React.FormEvent) {
    submit.preventDefault();
    setPending("access");
    setError(null);
    try {
      const response = await fetch(`/api/host/events/${event.id}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, access }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not add them.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add them.");
      setPending(null);
    }
  }

  async function removePerson(id: string) {
    setPending(id);
    setError(null);
    try {
      const response = await fetch(`/api/host/events/${event.id}/collaborators`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not remove them.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove them.");
      setPending(null);
    }
  }

  if (!canEdit) return null;

  return (
    <section className="studio-card" style={{ marginBottom: 22 }}>
      <p className="eyebrow">Manage Event</p>
      <h2>Event Actions</h2>
      <p className="muted">
        Postpone or cancel stays on this listing. Copy makes a fresh draft. User access is for this
        event only—not a new Venturo role.
      </p>
      <div className="event-dash-actions">
        <button
          className="btn btn-secondary"
          type="button"
          disabled={pending !== null}
          onClick={() => void run("copy")}
        >
          {pending === "copy" ? "Copying" : "Copy Event"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={pending !== null || event.status === "cancelled"}
          onClick={() => {
            if (window.confirm("Cancel this event? Guests will see it as cancelled.")) {
              void run("cancel", { refundIntent: refund });
            }
          }}
        >
          {pending === "cancel" ? "Cancelling" : "Cancel Event"}
        </button>
      </div>

      <form
        onSubmit={(submit) => {
          submit.preventDefault();
          void run("postpone", { startsAt, endsAt, refundIntent: refund });
        }}
      >
        <h3>Postpone Event</h3>
        <div className="field-row">
          <label className="field">
            <span>Starts</span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(change) => setStartsAt(change.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Ends</span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(change) => setEndsAt(change.target.value)}
              required
            />
          </label>
        </div>
        <label className="field">
          <span>Refunds</span>
          <select
            value={refund}
            onChange={(change) => setRefund(change.target.value as "none" | "requested")}
          >
            <option value="none">Keep tickets as they are</option>
            <option value="requested">Flag refunds for payout</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit" disabled={pending !== null}>
          {pending === "postpone" ? "Saving" : "Save New Times"}
        </button>
      </form>

      {isOwner ? (
        <div style={{ marginTop: 28 }}>
          <h3>User Access</h3>
          <p className="muted">
            Editors can change the listing. Door can scan. You stay the owner. Signed in as{" "}
            {actorEmail || "you"}.
          </p>
          <ul className="stack-list">
            {collaborators.length === 0 ? (
              <li className="muted">Nobody else on this event yet.</li>
            ) : (
              collaborators.map((person) => (
                <li key={person.id}>
                  {person.email} · {person.access === "door" ? "Door" : "Editor"}{" "}
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={pending !== null}
                    onClick={() => void removePerson(person.id)}
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
          <form className="field-row" onSubmit={(submit) => void addPerson(submit)}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(change) => setEmail(change.target.value)}
                required
                placeholder="cohost@example.com"
              />
            </label>
            <label className="field">
              <span>Access</span>
              <select
                value={access}
                onChange={(change) => setAccess(change.target.value as "editor" | "door")}
              >
                <option value="editor">Editor</option>
                <option value="door">Door</option>
              </select>
            </label>
            <button className="btn btn-secondary" type="submit" disabled={pending !== null}>
              Add
            </button>
          </form>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
    </section>
  );
}
