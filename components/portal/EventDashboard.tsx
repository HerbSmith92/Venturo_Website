"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EventPreview } from "@/components/EventPreview";
import { EventQr } from "@/components/portal/EventQr";
import type { EventDashboardData } from "@/lib/event-dashboard";
import { formatCents, isoToDatetimeLocal } from "@/lib/event-types";
import { portalDoorHref, portalMarketingInvitesHref, portalEventHref } from "@/lib/portal";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import type { VenturoEvent } from "@/lib/event-types";

function formatCount(n: number) {
  return new Intl.NumberFormat("en-ZA").format(n);
}

function formatDashboardRate(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  if (n >= 100) return "100%";
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(2)}%`;
}

export function EventDashboard({
  event,
  data,
  canEdit,
}: {
  event: VenturoEvent;
  data: EventDashboardData;
  canEdit: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [postponeOpen, setPostponeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [startsAt, setStartsAt] = useState(isoToDatetimeLocal(event.startsAt));
  const [endsAt, setEndsAt] = useState(isoToDatetimeLocal(event.endsAt));
  const [refund, setRefund] = useState<"none" | "requested">("none");

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return `/events/${event.slug}`;
    return `${window.location.origin}/events/${event.slug}`;
  }, [event.slug]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setNotice("Link copied.");
      setError(null);
    } catch {
      setError("Could not copy the link.");
    }
  }

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
      if (action === "cancel" || action === "postpone") window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section>
      <header className="event-dash-head">
        <div>
          <p className="eyebrow">Event Dashboard</p>
          <h2>How This One Is Tracking</h2>
        </div>
        <div className="event-dash-menu" ref={menuRef}>
          <button
            className="btn btn-primary event-dash-menu-btn"
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Event Actions
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {menuOpen ? (
            <div className="event-dash-menu-panel" id={menuId} role="menu" aria-label="Event Actions">
              <div className="colour-bar" aria-hidden="true" />
              <div className="event-dash-menu-list">
              <button
                className="event-dash-menu-item"
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setPreviewOpen(true);
                }}
              >
                Preview Event
              </button>
              <button
                className="event-dash-menu-item"
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  void copyLink();
                }}
              >
                Copy Link
              </button>
              <button
                className="event-dash-menu-item"
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setQrOpen((open) => !open);
                }}
              >
                Event QR Code
              </button>
              <a
                className="event-dash-menu-item"
                role="menuitem"
                href={portalMarketingInvitesHref(event.id)}
              >
                Send Invite
              </a>
              {event.status === "approved" ? (
                <a
                  className="event-dash-menu-item primary"
                  role="menuitem"
                  href={portalDoorHref(event.id)}
                >
                  Open Door
                </a>
              ) : null}
              {canEdit ? (
                <>
                  <button
                    className="event-dash-menu-item"
                    type="button"
                    role="menuitem"
                    disabled={pending !== null}
                    onClick={() => {
                      closeMenu();
                      void run("copy");
                    }}
                  >
                    {pending === "copy" ? "Copying" : "Copy Event"}
                  </button>
                  <button
                    className="event-dash-menu-item"
                    type="button"
                    role="menuitem"
                    disabled={pending !== null || event.status === "cancelled"}
                    onClick={() => {
                      closeMenu();
                      setPostponeOpen(true);
                    }}
                  >
                    Postpone Event
                  </button>
                  <button
                    className="event-dash-menu-item"
                    type="button"
                    role="menuitem"
                    disabled={pending !== null || event.status === "cancelled"}
                    onClick={() => {
                      closeMenu();
                      if (window.confirm("Cancel this event? Guests will see it as cancelled.")) {
                        void run("cancel", { refundIntent: refund });
                      }
                    }}
                  >
                    {pending === "cancel" ? "Cancelling" : "Cancel Event"}
                  </button>
                </>
              ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      {qrOpen ? (
        <div className="event-qr-wrap">
          <EventQr url={publicUrl} label={event.title} />
          <a href={publicUrl} target="_blank" rel="noreferrer">
            Open Event Page
          </a>
        </div>
      ) : null}

      {postponeOpen && canEdit ? (
        <form
          className="studio-card"
          onSubmit={(submit) => {
            submit.preventDefault();
            void run("postpone", { startsAt, endsAt, refundIntent: refund });
          }}
        >
          <h3>Postpone Event</h3>
          <p className="muted">New times stay live. Refunds are flagged—not taken from PayFast yet.</p>
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
      ) : null}

      <div className="event-dash-stats portal-stat-grid">
        <article className="portal-stat">
          <p className="eyebrow">Total Income</p>
          <strong>{formatCents(data.incomeCents)}</strong>
        </article>
        <article className="portal-stat">
          <p className="eyebrow">Total Tickets Sold</p>
          <strong>{formatCount(data.ticketsSold)}</strong>
        </article>
        <article className="portal-stat">
          <p className="eyebrow">Total Visits</p>
          <strong>{formatCount(data.visits)}</strong>
        </article>
        <article className="portal-stat">
          <p className="eyebrow">Conversion Rate</p>
          <strong>{formatDashboardRate(data.conversion)}</strong>
        </article>
      </div>

      <div className="portal-event-graphs event-dash-graphs">
        <PortalBarChart
          label="Visits"
          summary={formatCount(data.visits)}
          points={data.viewedSeries}
          color="var(--sapphire)"
        />
        <PortalBarChart
          label="Sold"
          summary={formatCount(data.ticketsSold)}
          stat={{ label: "Conversion", value: formatDashboardRate(data.conversion) }}
          points={data.soldSeries}
          color="var(--jade)"
        />
        <PortalBarChart
          label="Revenue (R)"
          summary={formatCents(data.incomeCents)}
          points={data.revenueSeries}
          color="var(--canary)"
          kind="rand"
        />
      </div>

      {previewOpen ? (
        <div className="studio-modal-wrap studio-preview-modal">
          <button className="studio-modal-backdrop" type="button" onClick={() => setPreviewOpen(false)} />
          <div className="studio-preview-sheet">
            <header className="studio-preview-sheet-top">
              <div>
                <p className="eyebrow">Preview</p>
                <h2>Your Event Page</h2>
              </div>
              <div className="hero-actions">
                <a className="btn btn-secondary" href={portalEventHref(event.id)}>
                  Menu
                </a>
                <button className="btn btn-ghost" type="button" onClick={() => setPreviewOpen(false)}>
                  Close
                </button>
              </div>
            </header>
            <EventPreview event={event} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
