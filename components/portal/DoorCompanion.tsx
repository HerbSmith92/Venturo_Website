"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { DoorGuest, DoorStats, ScanTicketResult } from "@/lib/host-scanning";

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
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function DoorCompanion({
  eventId,
  eventTitle,
  initialStats,
  initialGuests,
}: Props) {
  const [tab, setTab] = useState<Tab>("scan");
  const [stats, setStats] = useState(initialStats);
  const [guests, setGuests] = useState(initialGuests);
  const [code, setCode] = useState("");
  const [filter, setFilter] = useState("");
  const [lastResult, setLastResult] = useState<ScanTicketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningLock = useRef(false);
  const lastCameraCode = useRef<{ code: string; at: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function refreshDoor() {
    const response = await fetch(`/api/host/events/${eventId}/door`);
    const payload = (await response.json()) as {
      stats?: DoorStats;
      guests?: DoorGuest[];
      error?: string;
    };
    if (!response.ok) throw new Error(payload.error || "Could not refresh the door.");
    if (payload.stats) setStats(payload.stats);
    if (payload.guests) setGuests(payload.guests);
  }

  async function submitCode(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || scanningLock.current) return;
    scanningLock.current = true;
    setError(null);

    try {
      const response = await fetch("/api/host/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, code: trimmed }),
      });
      const payload = (await response.json()) as ScanTicketResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Scan failed.");

      setLastResult(payload);
      setCode("");
      if (payload.stats) setStats(payload.stats);
      startTransition(() => {
        void refreshDoor().catch(() => undefined);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      scanningLock.current = false;
      inputRef.current?.focus();
    }
  }

  useEffect(() => {
    if (!cameraOn) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;
    const Detector =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              BarcodeDetector?: new (options?: { formats: string[] }) => {
                detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
              };
            }
          ).BarcodeDetector
        : undefined;

    if (!Detector) {
      setCameraNote("This browser can’t read QR from the camera — paste or type the code instead.");
      setCameraOn(false);
      return;
    }

    const detector = new Detector({ formats: ["qr_code"] });

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraNote(null);

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) {
              const now = Date.now();
              const prior = lastCameraCode.current;
              if (prior && prior.code === value && now - prior.at < 4000) {
                // debounce same QR
              } else {
                lastCameraCode.current = { code: value, at: now };
                await submitCode(value);
              }
            }
          } catch {
            // keep looping
          }
          if (!cancelled) window.setTimeout(tick, 650);
        };
        void tick();
      } catch {
        setCameraNote("Camera permission blocked. Type the code or allow the camera and try again.");
        setCameraOn(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- camera lifecycle only
  }, [cameraOn, eventId]);

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

  return (
    <div className="door-companion">
      <header className="door-hero">
        <p className="eyebrow">Door</p>
        <h1>{eventTitle}</h1>
        <p className="lede muted">Scan them in. Watch the room fill. Keep the list honest.</p>
      </header>

      <section className="door-stats" aria-label="Guest counts">
        <article className="door-stat">
          <strong>{stats.scannedGuests}</strong>
          <span>Scanned</span>
        </article>
        <article className="door-stat accent">
          <strong>{stats.remainingGuests}</strong>
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
        <section className="door-panel" aria-label="Scan tickets">
          <form
            className="door-scan-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCode(code);
            }}
          >
            <label className="door-label" htmlFor="ticket-code">
              Ticket code
            </label>
            <div className="door-scan-row">
              <input
                ref={inputRef}
                id="ticket-code"
                name="code"
                value={code}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Scan or type code"
                onChange={(event) => setCode(event.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={pending || !code.trim()}>
                Check In
              </button>
            </div>
          </form>

          <div className="door-camera-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCameraOn((value) => !value)}
            >
              {cameraOn ? "Stop Camera" : "Open Camera"}
            </button>
            {cameraNote && <p className="muted door-camera-note">{cameraNote}</p>}
          </div>

          {cameraOn && (
            <div className="door-camera">
              <video ref={videoRef} muted playsInline />
              <span className="door-camera-frame" aria-hidden="true" />
            </div>
          )}

          {error && <p className="door-flash bad">{error}</p>}

          {lastResult && (
            <div className={`door-flash ${resultTone ?? ""}`} role="status">
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
        <section className="door-panel" aria-label="Guest list">
          <label className="door-label" htmlFor="guest-filter">
            Find a guest
          </label>
          <input
            id="guest-filter"
            value={filter}
            placeholder="Name, email, code…"
            onChange={(event) => setFilter(event.target.value)}
          />

          {filtered.length === 0 ? (
            <p className="muted" style={{ marginTop: 20 }}>
              {guests.length === 0
                ? "No tickets sold yet — the list fills as guests buy."
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
