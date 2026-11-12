"use client";

import { useEffect, useState } from "react";
import type { EventHostContact } from "@/lib/event-host";

function contactLine(host: EventHostContact) {
  return [host.email, host.phone].filter(Boolean).join(" · ");
}

export function EventOwner({
  eventId,
  host,
}: {
  eventId: string;
  host: EventHostContact | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventHostContact[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(!host);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      const response = await fetch(`/api/admin/events/hosts?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { hosts?: EventHostContact[]; error?: string };
      setSearching(false);
      if (!response.ok) {
        setError(payload.error ?? "Could not search members.");
        return;
      }
      setResults((payload.hosts ?? []).filter((item) => item.userId !== host?.userId));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [open, query, host?.userId]);

  async function assign(userId: string) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/admin/events/owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, userId }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not assign that host.");
      return;
    }
    window.location.reload();
  }

  return (
    <section className="stack-list cr-event-host" style={{ marginTop: 28 }}>
      <h2>Belongs to</h2>
      <p className="muted">
        The Event Host portal, payouts, & door follow this account. Use it when you need to ring or
        mail the host.
      </p>

      {host ? (
        <article>
          <strong>{host.name}</strong>
          <p className="muted" style={{ marginTop: 6 }}>
            {host.email ? (
              <a href={`mailto:${host.email}`}>{host.email}</a>
            ) : (
              "No email on file"
            )}
            {host.phone ? (
              <>
                {" · "}
                <a href={`tel:${host.phone.replace(/\s+/g, "")}`}>{host.phone}</a>
              </>
            ) : null}
          </p>
        </article>
      ) : (
        <p className="notice">No host on this event yet. Search a member & assign them.</p>
      )}

      <button
        className="btn btn-secondary"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close search" : host ? "Change host" : "Assign host"}
      </button>

      {open ? (
        <div className="cr-guide-search">
          <label className="field">
            <span>Search members</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, email, or phone"
              autoFocus
            />
          </label>
          <p className="muted">{searching ? "Searching…" : "Members & Event Hosts on Venturo."}</p>
          {error ? <p className="error">{error}</p> : null}
          {!searching && results.length === 0 ? (
            <p className="muted">
              {query.trim() ? "No matching members." : "Type a name, email, or phone."}
            </p>
          ) : null}
          <ul className="cr-guide-results">
            {results.map((item) => (
              <li key={item.userId}>
                <button type="button" disabled={pending} onClick={() => assign(item.userId)}>
                  <strong>{item.name}</strong>
                  <span className="muted">{contactLine(item) || "No contact on file"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : error ? (
        <p className="error">{error}</p>
      ) : null}
    </section>
  );
}
