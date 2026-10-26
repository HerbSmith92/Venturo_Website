"use client";

import { useMemo, useState } from "react";
import { ticketSalesPreview } from "@/lib/event-fees";
import { formatCents, type PlatformFees } from "@/lib/event-types";

export function FeeSettingsForm({ fees }: { fees: PlatformFees }) {
  const [pct, setPct] = useState(String(fees.commissionPct));
  const [bookingRands, setBookingRands] = useState((fees.bookingFeeCents / 100).toFixed(2));
  const [memberPct, setMemberPct] = useState(String(fees.memberDiscountPct));
  const [passBooking, setPassBooking] = useState(fees.passBookingToBuyer);
  const [passCommission, setPassCommission] = useState(fees.passCommissionToBuyer);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(
    () =>
      ticketSalesPreview(
        {
          kind: "paid",
          priceRands: "50.00",
          discountKind: Number(memberPct) > 0 ? "percent" : "none",
          discountValue: memberPct,
          membersOnly: false,
          quantity: "1",
          passFeesToBuyer: passBooking,
          passCommissionToBuyer: passCommission,
        },
        {
          commissionPct: Number(pct) || 0,
          bookingFeeCents: Math.round((Number(bookingRands) || 0) * 100),
          memberDiscountPct: Number(memberPct) || 0,
          passBookingToBuyer: passBooking,
          passCommissionToBuyer: passCommission,
        },
      ),
    [pct, bookingRands, memberPct, passBooking, passCommission],
  );

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
        passBookingToBuyer: passBooking,
        passCommissionToBuyer: passCommission,
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
    setPassBooking(payload.fees.passBookingToBuyer);
    setPassCommission(payload.fees.passCommissionToBuyer);
    setMessage("Saved. New tickets & member checkout use these rates.");
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
      <div className="field-row">
        <label className="field">
          <span>Who pays the booking fee</span>
          <select
            value={passBooking ? "buyer" : "host"}
            onChange={(event) => setPassBooking(event.target.value === "buyer")}
          >
            <option value="host">Host, from the payout</option>
            <option value="buyer">Buyer, at checkout</option>
          </select>
        </label>
        <label className="field">
          <span>Who pays the commission</span>
          <select
            value={passCommission ? "buyer" : "host"}
            onChange={(event) => setPassCommission(event.target.value === "buyer")}
          >
            <option value="host">Host, from the payout</option>
            <option value="buyer">Buyer, at checkout</option>
          </select>
        </label>
      </div>
      <p className="muted">
        Commission & the booking fee apply to every paid ticket. The member discount applies when a
        ticket has no discount of its own. New tickets start with this fee share. A host can still
        change the share on one ticket.
      </p>
      <div className="plan">
        <p className="eyebrow">Worked example</p>
        <h2>One ticket at R 50.00</h2>
        <ul>
          <li>Standard price: {formatCents(preview.list)}</li>
          <li>
            Member price: {preview.member != null ? formatCents(preview.member) : "Same as standard"}
          </li>
          <li>Buyer pays, standard: {formatCents(preview.standardBuyer)}</li>
          <li>Host keeps, standard: {formatCents(preview.standardKeep)}</li>
          {preview.memberBuyer != null && preview.memberKeep != null ? (
            <>
              <li>Buyer pays, member: {formatCents(preview.memberBuyer)}</li>
              <li>Host keeps, member: {formatCents(preview.memberKeep)}</li>
            </>
          ) : null}
        </ul>
      </div>
      {error && <p className="error">{error}</p>}
      {message && <p className="notice">{message}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Save ticket fees"}
      </button>
    </form>
  );
}
