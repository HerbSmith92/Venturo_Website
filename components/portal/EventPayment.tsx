"use client";

import { useState } from "react";
import { HostPayoutForm } from "@/components/portal/HostPayoutForm";
import { formatCents } from "@/lib/event-types";
import { PORTAL_SETTINGS } from "@/lib/portal";
import type { EventPayoutSummary } from "@/lib/event-payouts";
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

  return (
    <section>
      <p className="eyebrow">Payment</p>
      <h2>How Money Moves</h2>
      <p className="lede muted">
        Guests pay with PayFast on the website. We pay this event out <strong>3 working days</strong>{" "}
        after it ends. Apple Pay &amp; Samsung Pay are not ticket rails here.
      </p>

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
          <li>PayFast — live for ticket checkout on {event.title}.</li>
          <li>Payouts land 3 working days after the event.</li>
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
                <label className="field">
                  <span>Code</span>
                  <input
                    value={code}
                    onChange={(change) => setCode(change.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
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
