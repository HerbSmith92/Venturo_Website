"use client";

import { useCallback, useEffect, useState } from "react";
import { PAID_PRICE } from "@/lib/brand";

export function MembershipCheckoutForm({
  autoStart = false,
  cancelled = false,
}: {
  autoStart?: boolean;
  cancelled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [payfast, setPayfast] = useState<{
    action: string;
    fields: Record<string, string>;
  } | null>(null);

  const startCheckout = useCallback(async () => {
    setError(null);
    setPending(true);
    const response = await fetch("/api/membership/checkout", { method: "POST" });
    const payload = (await response.json()) as {
      error?: string;
      redirect?: string;
      payfast?: { action: string; fields: Record<string, string> };
    };
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not start checkout.");
      return;
    }
    if (payload.redirect) {
      window.location.href = payload.redirect;
      return;
    }
    if (payload.payfast) {
      setPayfast(payload.payfast);
      return;
    }
    setError("Unexpected checkout response.");
  }, []);

  useEffect(() => {
    if (!autoStart || cancelled) return;
    void startCheckout();
  }, [autoStart, cancelled, startCheckout]);

  useEffect(() => {
    if (!payfast) return;
    const form = document.getElementById("payfast-membership-form") as HTMLFormElement | null;
    form?.submit();
  }, [payfast]);

  if (payfast) {
    return (
      <form id="payfast-membership-form" action={payfast.action} method="post" className="auth-card">
        <p className="eyebrow">PayFast</p>
        <h1>Continue To Payment</h1>
        <p className="lede muted">
          Redirecting you to PayFast for {PAID_PRICE} / month. If nothing happens, tap the button.
        </p>
        {Object.entries(payfast.fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button className="btn btn-primary" type="submit">
          Pay With PayFast
        </button>
      </form>
    );
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">Subscribe</p>
      <h1>Venturo Membership</h1>
      <p className="lede muted">
        {PAID_PRICE} per month via PayFast. Cancel anytime from your PayFast account or by
        contacting us. App Store & Play Store remain for the mobile app.
      </p>
      {cancelled && (
        <p className="notice">Checkout cancelled. You can try again when you&apos;re ready.</p>
      )}
      {error && <p className="error">{error}</p>}
      <button
        className="btn btn-primary"
        type="button"
        disabled={pending}
        onClick={() => void startCheckout()}
      >
        {pending ? "Please Wait" : `Subscribe · ${PAID_PRICE} / month`}
      </button>
      <p className="muted" style={{ marginTop: 16 }}>
        <a href="/account">Back to profile</a>
      </p>
    </div>
  );
}
