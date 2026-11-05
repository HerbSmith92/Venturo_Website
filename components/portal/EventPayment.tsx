"use client";

import { useState } from "react";
import { OtpCodeBoxes } from "@/components/OtpCodeBoxes";
import { HostPayoutForm } from "@/components/portal/HostPayoutForm";
import { formatCents } from "@/lib/event-types";
import { formatCount, formatWhen } from "@/lib/overview/metrics";
import { payoutDueLabel, type EventPayoutSummary } from "@/lib/event-payouts";
import { PORTAL_SETTINGS } from "@/lib/portal";
import type { VenturoEvent } from "@/lib/event-types";

type ExistingPayout = {
  accountHolder: string;
  bankName: string;
  accountNumberLast4: string;
  branchCode: string | null;
} | null;

export function EventPayment({
  event,
  summary,
  existingPayout,
  hostEmail,
  fallbackHolder,
  canEditBank,
}: {
  event: VenturoEvent;
  summary: EventPayoutSummary;
  existingPayout: ExistingPayout;
  hostEmail: string;
  fallbackHolder: string;
  canEditBank: boolean;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendCode() {
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("email", hostEmail);
      form.set("mode", "login");
      const response = await fetch("/auth/otp/send", { method: "POST", body: form });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not send a code.");
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send a code.");
    } finally {
      setPending(false);
    }
  }

  async function verify(submit: React.FormEvent) {
    submit.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/host/payout/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: hostEmail, token: code }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "That code did not match.");
      setUnlocked(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code did not match.");
    } finally {
      setPending(false);
    }
  }

  const bankLast4 = existingPayout?.accountNumberLast4 ?? null;
  const extras = [
    summary.complimentaryCount ? `${formatCount(summary.complimentaryCount)} complimentary` : null,
    summary.freeCount ? `${formatCount(summary.freeCount)} free RSVP` : null,
  ].filter(Boolean);

  return (
    <section>
      <p className="eyebrow">Payment</p>
      <h2>{summary.ended ? "Payout report" : "How Money Moves"}</h2>
      <p className="lede muted">
        {summary.ended
          ? `This event ended ${summary.endsAt ? formatWhen(summary.endsAt) : "already"}. We pay you 2 working days after it ends. Venturo sends that payout by hand.`
          : "Guests pay with Paystack on the website. We pay this event out 2 working days after it ends. Venturo sends that payout by hand. Apple Pay & Samsung Pay are not supported payment methods for tickets here."}
      </p>

      <div className="studio-card" style={{ marginBottom: 22 }}>
        <h3>{summary.ended ? "What we pay you" : "So far (not yet due)"}</h3>
        <div className="event-dash-stats portal-stat-grid">
          <article className="portal-stat">
            <p className="eyebrow">Tickets bought</p>
            <strong>{formatCount(summary.ticketsBought)}</strong>
            {extras.length ? <p className="muted">{extras.join(" · ")}</p> : null}
          </article>
          <article className="portal-stat">
            <p className="eyebrow">{summary.ended ? "Amount we pay you" : "Host keep so far"}</p>
            <strong>{formatCents(summary.ended ? summary.owedCents : summary.hostKeepCents)}</strong>
          </article>
          <article className="portal-stat">
            <p className="eyebrow">Fees kept by Venturo</p>
            <strong>{formatCents(summary.venturoFeesCents)}</strong>
          </article>
          <article className="portal-stat">
            <p className="eyebrow">Due</p>
            <strong>{payoutDueLabel(summary)}</strong>
          </article>
          <article className="portal-stat">
            <p className="eyebrow">Bank</p>
            <strong>{bankLast4 ? `···· ${bankLast4}` : "Not set"}</strong>
            {existingPayout?.accountHolder ? <p className="muted">{existingPayout.accountHolder}</p> : null}
          </article>
        </div>
      </div>

      <div className="event-dash-stats portal-stat-grid">
        <article className="portal-stat">
          <p className="eyebrow">Owed</p>
          <strong>{formatCents(summary.owedCents)}</strong>
        </article>
        <article className="portal-stat">
          <p className="eyebrow">Paid Out</p>
          <strong>{formatCents(summary.paidOutCents)}</strong>
        </article>
        <article className="portal-stat">
          <p className="eyebrow">Waived</p>
          <strong>{formatCents(summary.waivedCents)}</strong>
        </article>
      </div>

      <div className="studio-card" style={{ marginBottom: 22 }}>
        <h3>Payment Options</h3>
        <ul className="stack-list">
          <li>Paystack takes ticket payments for {event.title}.</li>
          <li>Payouts land 2 working days after the event. Venturo sends them by hand.</li>
          <li>One bank for every paid event. Change it below.</li>
        </ul>
      </div>

      <div className="studio-card">
        <h3>Bank Details</h3>
        {!canEditBank ? (
          <p className="muted">
            Only the event owner can change the payout bank. It lives in{" "}
            <a href={PORTAL_SETTINGS}>Host Settings</a>.
          </p>
        ) : !unlocked ? (
          <div className="event-otp-gate">
            <p className="muted">
              We send a one-time code to {hostEmail || "your login email"} before bank details.
            </p>
            {sent ? (
              <form onSubmit={(submit) => void verify(submit)}>
                <div className="field">
                  <span>Code</span>
                  <OtpCodeBoxes value={code} onChange={setCode} disabled={pending} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Checking" : "Unlock Bank"}
                </button>
              </form>
            ) : (
              <button className="btn btn-primary" type="button" disabled={pending || !hostEmail} onClick={() => void sendCode()}>
                {pending ? "Sending" : "Send Code"}
              </button>
            )}
          </div>
        ) : (
          <HostPayoutForm existingPayout={existingPayout} fallbackHolder={fallbackHolder} />
        )}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </section>
  );
}
