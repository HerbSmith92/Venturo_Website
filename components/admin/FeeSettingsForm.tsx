"use client";

import { useState } from "react";
import { formatCents } from "@/lib/event-types";

export function FeeSettingsForm({
  commissionPct,
  bookingFeeCents,
}: {
  commissionPct: number;
  bookingFeeCents: number;
}) {
  const [pct, setPct] = useState(String(commissionPct));
  const [bookingRands, setBookingRands] = useState(
    (bookingFeeCents / 100).toFixed(2),
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commissionPct: Number(pct),
        bookingFeeRands: Number(bookingRands),
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      commissionPct?: number;
      bookingFeeCents?: number;
    };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save fees.");
      return;
    }
    if (payload.commissionPct !== undefined) setPct(String(payload.commissionPct));
    if (payload.bookingFeeCents !== undefined) {
      setBookingRands((payload.bookingFeeCents / 100).toFixed(2));
    }
    setMessage(
      `Saved. Commission ${payload.commissionPct}% · booking ${formatCents(payload.bookingFeeCents ?? 0)}.`,
    );
  }

  return (
    <form className="stack-list" onSubmit={onSubmit}>
      <div className="field-row">
        <label className="field">
          <span>Commission %</span>
          <input
            inputMode="decimal"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            min={0}
            max={100}
            step="0.01"
          />
        </label>
        <label className="field">
          <span>Booking Fee (R 00.00)</span>
          <div className="money-input">
            <span>R</span>
            <input
              inputMode="decimal"
              value={bookingRands}
              onChange={(e) => setBookingRands(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </label>
      </div>
      <p className="muted">
        Taken from the organiser payout on paid tickets. Leave at 0 until rates
        are locked.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="notice">{message}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Save Fee Settings"}
      </button>
    </form>
  );
}
