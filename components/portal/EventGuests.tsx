"use client";

import { useMemo, useState } from "react";
import type { EventInvite } from "@/lib/event-marketing";
import { invitePublicUrl } from "@/lib/event-links";
import { buildGuestListPdf, downloadGuestListPdf } from "@/lib/guest-list-pdf";
import { portalDoorHref } from "@/lib/portal";
import type { DoorGuest } from "@/lib/host-scanning";
import { formatEventWindow, type VenturoEvent } from "@/lib/event-types";

export function EventGuests({
  event,
  guests,
  invites,
  canEdit,
}: {
  event: VenturoEvent;
  guests: DoorGuest[];
  invites: EventInvite[];
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const types = useMemo(
    () => Array.from(new Set(guests.map((guest) => guest.ticketTypeName))),
    [guests],
  );
  const filtered = filter === "all" ? guests : guests.filter((guest) => guest.ticketTypeName === filter);

  async function issueComp(submit: React.FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    const payload = Object.fromEntries(new FormData(submit.currentTarget).entries());
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/host/events/${event.id}/comp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(payload.name ?? ""),
          email: String(payload.email ?? ""),
          phone: String(payload.phone ?? ""),
          ticketTypeId: String(payload.ticketTypeId ?? ""),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not issue that ticket.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not issue that ticket.");
      setPending(false);
    }
  }

  async function createRsvp(submit: React.FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    const payload = Object.fromEntries(new FormData(submit.currentTarget).entries());
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/host/events/${event.id}/marketing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "invite",
          inviteKind: "rsvp",
          email: String(payload.email ?? ""),
          name: String(payload.name ?? ""),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not create the RSVP.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the RSVP.");
      setPending(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied.");
    } catch {
      setError("Could not copy.");
    }
  }

  function exportPdf() {
    setError(null);
    try {
      const bytes = buildGuestListPdf({
        title: event.title,
        when: formatEventWindow(event.startsAt, event.endsAt, event.timezone),
        place: [event.venueName, event.city].filter(Boolean).join(" · "),
        filter: filter === "all" ? "All" : filter,
        rows: filtered.map((guest) => ({
          name: guest.guestName || "—",
          phone: guest.guestPhone || "—",
          email: guest.guestEmail || "—",
          ticket: guest.ticketTypeName,
          door: guest.isScanned ? "Scanned" : "Still to come",
        })),
      });
      downloadGuestListPdf(`${event.slug}-guest-list`, bytes);
      setNotice("PDF downloaded. Open it to print if you need a paper copy.");
    } catch {
      setError("Could not export that PDF.");
    }
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <section>
      <div className="event-guest-toolbar">
        <div>
          <p className="eyebrow">Guest Management</p>
          <h2>Who&apos;s On The List</h2>
        </div>
        <a className="btn btn-primary" href={portalDoorHref(event.id)}>
          Open Door
        </a>
        <button className="btn btn-secondary" type="button" onClick={() => exportPdf()}>
          Export PDF
        </button>
        <label className="field">
          <span>Filtered Tickets</span>
          <select value={filter} onChange={(change) => setFilter(change.target.value)}>
            <option value="all">All</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <table className="event-guest-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Cellphone Number</th>
            <th>Email</th>
            <th>Ticket</th>
            <th>Door</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                Nobody on this list yet.
              </td>
            </tr>
          ) : (
            filtered.map((guest) => (
              <tr key={guest.ticketId}>
                <td>{guest.guestName || "—"}</td>
                <td>{guest.guestPhone || "—"}</td>
                <td>{guest.guestEmail || "—"}</td>
                <td>{guest.ticketTypeName}</td>
                <td>{guest.isScanned ? "Scanned" : "Still to come"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {canEdit ? (
        <>
          <div className="studio-card" style={{ marginTop: 28 }}>
            <h3>Send Complimentary</h3>
            <form onSubmit={(submit) => void issueComp(submit)}>
              <div className="field-row">
                <label className="field">
                  <span>Name</span>
                  <input name="name" required />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input name="email" type="email" required />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Cellphone Number</span>
                  <input name="phone" placeholder="082-123-4567" />
                </label>
                <label className="field">
                  <span>Ticket Type</span>
                  <select name="ticketTypeId" required defaultValue={event.ticketTypes[0]?.id ?? ""}>
                    {event.ticketTypes.map((ticket) => (
                      <option key={ticket.id} value={ticket.id}>
                        {ticket.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="btn btn-primary" type="submit" disabled={pending || event.ticketTypes.length === 0}>
                Issue Ticket
              </button>
            </form>
          </div>

          <div className="studio-card" style={{ marginTop: 22 }}>
            <h3>Invite RSVP</h3>
            <p className="muted">
              They open the link, accept, &amp; we mint a complimentary ticket. Copy the link—we do
              not send email yet.
            </p>
            <ul className="campaign-list">
              {invites.length === 0 ? (
                <li className="muted">No RSVPs yet.</li>
              ) : (
                invites.map((invite) => {
                  const url = invitePublicUrl(invite.token, origin);
                  const label =
                    invite.status === "claimed" || invite.status === "accepted"
                      ? "On the list"
                      : invite.status === "opened"
                        ? "Opened"
                        : invite.status === "revoked"
                          ? "Revoked"
                          : "Waiting";
                  return (
                    <li key={invite.id} className="campaign-row">
                      <div>
                        <strong>{invite.name || invite.email}</strong>
                        {invite.name ? <p className="muted">{invite.email}</p> : null}
                        <p className="muted campaign-url">{url}</p>
                      </div>
                      <div className="campaign-stat">
                        <p className="eyebrow">Status</p>
                        <strong className="invite-status">{label}</strong>
                      </div>
                      <button className="btn btn-secondary" type="button" onClick={() => void copy(url)}>
                        Copy Link
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <form onSubmit={(submit) => void createRsvp(submit)}>
              <div className="field-row">
                <label className="field">
                  <span>Name</span>
                  <input name="name" />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input name="email" type="email" required />
                </label>
              </div>
              <button className="btn btn-primary" type="submit" disabled={pending}>
                Create RSVP Link
              </button>
            </form>
          </div>
        </>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
    </section>
  );
}
