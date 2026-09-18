"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CompanionScanner } from "@/components/companion/CompanionScanner";
import type { DoorGuest, DoorStats, ScanTicketResult } from "@/lib/host-scanning";
import { normalizeTicketCode } from "@/lib/ticket-code";
import {
  applyLocalCheckIn,
  listQueuedScans,
  loadCachedDoor,
  queueScan,
  removeQueuedScan,
  saveCachedDoor,
} from "@/lib/companion-offline";

type Tab = "scan" | "guests";

type Props = {
  eventId: string;
  eventTitle: string;
  initialStats: DoorStats;
  initialGuests: DoorGuest[];
};

function guestLabel(guest: Pick<DoorGuest, "guestName" | "guestEmail" | "code">) {
  return guest.guestName || guest.guestEmail || `Ticket ${guest.code}`;
}

function formatWhen(iso: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function findGuest(guests: DoorGuest[], code: string) {
  const needle = normalizeTicketCode(code);
  return guests.find((guest) => guest.code.toUpperCase() === needle);
}

export function CompanionDoor({ eventId, eventTitle, initialStats, initialGuests }: Props) {
  const [tab, setTab] = useState<Tab>("scan");
  const [stats, setStats] = useState(initialStats);
  const [guests, setGuests] = useState(initialGuests);
  const [code, setCode] = useState("");
  const [filter, setFilter] = useState("");
  const [lastResult, setLastResult] = useState<ScanTicketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const lock = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const persist = useCallback(
    async (nextGuests: DoorGuest[], nextStats: DoorStats) => {
      await saveCachedDoor({
        eventId,
        title: eventTitle,
        guests: nextGuests,
        stats: nextStats,
        cachedAt: new Date().toISOString(),
      });
    },
    [eventId, eventTitle],
  );

  const refreshQueued = useCallback(async () => {
    const items = await listQueuedScans(eventId);
    setQueued(items.length);
  }, [eventId]);

  const refreshDoor = useCallback(async () => {
    const response = await fetch(`/api/host/events/${eventId}/door`);
    const payload = (await response.json()) as {
      stats?: DoorStats;
      guests?: DoorGuest[];
      error?: string;
    };
    if (!response.ok) throw new Error(payload.error || "Could not refresh the door.");
    if (payload.stats) setStats(payload.stats);
    if (payload.guests) setGuests(payload.guests);
    setFromCache(false);
    if (payload.stats && payload.guests) {
      await persist(payload.guests, payload.stats);
    }
  }, [eventId, persist]);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const items = await listQueuedScans(eventId);
    if (!items.length) return;
    setSyncing(true);
    try {
      for (const item of items) {
        const response = await fetch("/api/host/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, code: item.code }),
        });
        if (response.ok || response.status === 400) {
          await removeQueuedScan(item.id);
        }
      }
      await refreshDoor();
      await refreshQueued();
    } catch {
      await refreshQueued();
    } finally {
      setSyncing(false);
    }
  }, [eventId, refreshDoor, refreshQueued]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (initialGuests.length) {
      void persist(initialGuests, initialStats);
      return;
    }
    void loadCachedDoor(eventId).then((cached) => {
      if (!cached) return;
      setGuests(cached.guests);
      setStats(cached.stats);
      setFromCache(true);
    });
  }, [eventId, initialGuests, initialStats, persist]);

  useEffect(() => {
    void refreshQueued();
  }, [refreshQueued]);

  useEffect(() => {
    if (!online) return;
    void flushQueue();
    const timer = window.setInterval(() => {
      void flushQueue();
    }, 25000);
    return () => window.clearInterval(timer);
  }, [online, flushQueue]);

  async function submitCode(raw: string) {
    const trimmed = normalizeTicketCode(raw);
    if (!trimmed || lock.current) return;
    lock.current = true;
    setError(null);

    try {
      if (navigator.onLine) {
        const response = await fetch("/api/host/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, code: trimmed }),
        });
        const payload = (await response.json()) as ScanTicketResult & { error?: string };
        if (!response.ok && !payload.result) {
          throw new Error(payload.error || "Scan failed.");
        }
        setLastResult(payload);
        setCode("");
        const applied = applyLocalCheckIn(guests, stats, payload);
        setGuests(applied.guests);
        setStats(applied.stats);
        await persist(applied.guests, applied.stats);
        if (payload.ok || payload.result === "already_scanned") {
          try {
            navigator.vibrate?.(40);
          } catch {
            // ignore
          }
        }
        void refreshDoor().catch(() => undefined);
        return;
      }

      const local = findGuest(guests, trimmed);
      if (local?.isScanned) {
        const payload: ScanTicketResult = {
          ok: false,
          result: "already_scanned",
          message: "Already scanned. Saved on this phone.",
          ticket: {
            id: local.ticketId,
            code: local.code,
            ticketTypeName: local.ticketTypeName,
            guestName: local.guestName,
            guestEmail: local.guestEmail,
            scannedAt: local.scannedAt,
            isScanned: true,
          },
          stats,
        };
        setLastResult(payload);
        setCode("");
        return;
      }

      await queueScan(eventId, trimmed);
      await refreshQueued();

      if (local) {
        const payload: ScanTicketResult = {
          ok: true,
          result: "ok",
          message: "Checked in offline. We’ll sync when you’re back online.",
          ticket: {
            id: local.ticketId,
            code: local.code,
            ticketTypeName: local.ticketTypeName,
            guestName: local.guestName,
            guestEmail: local.guestEmail,
            scannedAt: new Date().toISOString(),
            isScanned: true,
          },
        };
        const applied = applyLocalCheckIn(guests, stats, payload);
        setLastResult({ ...payload, stats: applied.stats });
        setGuests(applied.guests);
        setStats(applied.stats);
        await persist(applied.guests, applied.stats);
      } else {
        setLastResult({
          ok: true,
          result: "ok",
          message: "Saved offline. We’ll confirm this code when you’re back online.",
        });
      }
      setCode("");
      try {
        navigator.vibrate?.(40);
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      lock.current = false;
      inputRef.current?.focus();
    }
  }

  const filtered = guests.filter((guest) => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return true;
    return (
      guestLabel(guest).toLowerCase().includes(needle) ||
      guest.code.toLowerCase().includes(needle) ||
      guest.ticketTypeName.toLowerCase().includes(needle)
    );
  });

  const resultTone =
    lastResult?.result === "ok"
      ? "ok"
      : lastResult?.result === "already_scanned"
        ? "warn"
        : lastResult
          ? "bad"
          : null;

  const waiting = useMemo(() => guests.filter((guest) => !guest.isScanned).length, [guests]);

  return (
    <div className="companion-door">
      <header className="companion-hero">
        <p className="lede muted">Point at a phone or a printed QR. The list stays on this device.</p>
      </header>

      <div className="companion-status-row">
        <span className={`companion-pill ${online ? "ok" : "warn"}`}>
          {online ? "Online" : "Offline"}
        </span>
        {fromCache && <span className="companion-pill">Saved list</span>}
        {queued > 0 && (
          <span className="companion-pill warn">
            {queued} waiting to sync
          </span>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!online || syncing}
          onClick={() => void flushQueue()}
        >
          {syncing ? "Syncing…" : "Sync"}
        </button>
      </div>

      <section className="door-stats" aria-label="Guest counts">
        <article className="door-stat">
          <strong>{stats.scannedGuests}</strong>
          <span>Scanned</span>
        </article>
        <article className="door-stat accent">
          <strong>{stats.remainingGuests || waiting}</strong>
          <span>Still to come</span>
        </article>
        <article className="door-stat">
          <strong>{stats.totalGuests}</strong>
          <span>On the list</span>
        </article>
      </section>

      <div className="door-tabs" role="tablist" aria-label="Door tools">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "scan"}
          className={tab === "scan" ? "on" : undefined}
          onClick={() => setTab("scan")}
        >
          Scan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "guests"}
          className={tab === "guests" ? "on" : undefined}
          onClick={() => setTab("guests")}
        >
          Guest List
        </button>
      </div>

      {tab === "scan" ? (
        <section className="companion-panel" aria-label="Scan tickets">
          <CompanionScanner active={tab === "scan"} onCode={(value) => void submitCode(value)} />

          <form
            className="door-scan-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCode(code);
            }}
          >
            <label className="door-label" htmlFor="companion-ticket-code">
              Or type the code
            </label>
            <div className="door-scan-row">
              <input
                ref={inputRef}
                id="companion-ticket-code"
                name="code"
                value={code}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Scan or type code"
                onChange={(event) => setCode(event.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={!code.trim()}>
                Check In
              </button>
            </div>
          </form>

          {error && <p className="companion-flash bad">{error}</p>}

          {lastResult && (
            <div className={`companion-flash ${resultTone ?? ""}`} role="status">
              <p className="door-flash-title">{lastResult.message}</p>
              {lastResult.ticket && (
                <p className="muted">
                  {guestLabel({
                    guestName: lastResult.ticket.guestName,
                    guestEmail: lastResult.ticket.guestEmail,
                    code: lastResult.ticket.code,
                  })}
                  {" · "}
                  {lastResult.ticket.ticketTypeName}
                  {" · "}
                  {lastResult.ticket.code}
                </p>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="companion-panel" aria-label="Guest list">
          <label className="door-label" htmlFor="companion-guest-filter">
            Find a guest
          </label>
          <input
            id="companion-guest-filter"
            value={filter}
            placeholder="Name, email, code…"
            onChange={(event) => setFilter(event.target.value)}
          />

          {filtered.length === 0 ? (
            <p className="muted" style={{ marginTop: 20 }}>
              {guests.length === 0
                ? "No tickets on this list yet. Sync when you have a signal, or wait for the first sale."
                : "No guests match that search."}
            </p>
          ) : (
            <ul className="door-guest-list">
              {filtered.map((guest) => (
                <li key={guest.ticketId} className={guest.isScanned ? "in" : "out"}>
                  <div>
                    <strong>{guestLabel(guest)}</strong>
                    <p className="muted">
                      {guest.ticketTypeName}
                      {guest.guestEmail ? ` · ${guest.guestEmail}` : ""}
                      {" · "}
                      {guest.code}
                    </p>
                    <p className="muted">
                      Bought {formatWhen(guest.purchasedAt)}
                      {guest.isScanned && guest.scannedAt
                        ? ` · Scanned ${formatWhen(guest.scannedAt)}`
                        : ""}
                    </p>
                  </div>
                  <span className={`door-badge ${guest.isScanned ? "in" : "out"}`}>
                    {guest.isScanned ? "Scanned" : "Waiting"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
