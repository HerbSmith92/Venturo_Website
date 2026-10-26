"use client";

import { useState } from "react";
import type { PlatformFees } from "@/lib/event-types";

export function FeeSettingsForm({ fees }: { fees: PlatformFees }) {
  const [pct, setPct] = useState(String(fees.commissionPct));
  const [bookingRands, setBookingRands] = useState((fees.bookingFeeCents / 100).toFixed(2));
  const [memberPct, setMemberPct] = useState(String(fees.memberDiscountPct));
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
        memberDiscountPct: Number(memberPct),
      }),
    });
    const payload = (await response.json()) as { error?: string; fees?: PlatformFees };
    setPending(false);
    if (!response.ok || !payload.fees) {
      setError(payload.error ?? "Could not save fees.");
      return;
    }
    setPct(String(payload.fees.commissionPct));
    setBookingRands((payload.fees.bookingFeeCents / 100).toFixed(2));
    setMemberPct(String(payload.fees.memberDiscountPct));
    setMessage("Saved.");
  }

  return (
    <form className="stack-list fee-settings" onSubmit={onSubmit}>
      <div className="field-row fee-rates">
        <label className="field">
          <span>Commission %</span>
          <input inputMode="decimal" value={pct} onChange={(event) => setPct(event.target.value)} />
        </label>
        <label className="field">
          <span>Booking fee per ticket</span>
          <div className="money-input">
            <span>R</span>
            <input
              inputMode="decimal"
              value={bookingRands}
              onChange={(event) => setBookingRands(event.target.value)}
              placeholder="0.00"
            />
          </div>
        </label>
        <label className="field">
          <span>Member discount %</span>
          <input
            inputMode="decimal"
            value={memberPct}
            onChange={(event) => setMemberPct(event.target.value)}
          />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {message && <p className="notice">{message}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Save ticket fees"}
      </button>
    </form>
  );
}
