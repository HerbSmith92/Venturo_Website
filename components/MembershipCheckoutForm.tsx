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

  const startCheckout = useCallback(async () => {
    setError(null);
    setPending(true);
    const response = await fetch("/api/membership/checkout", { method: "POST" });
    const payload = (await response.json()) as {
      error?: string;
      redirect?: string;
      authorizationUrl?: string;
    };

    if (!response.ok) {
      setPending(false);
      setError(payload.error ?? "Could not start checkout.");
      return;
    }
    if (payload.redirect) {
      window.location.href = payload.redirect;
      return;
    }
    if (payload.authorizationUrl) {
      window.location.href = payload.authorizationUrl;
      return;
    }
    setPending(false);
    setError("Unexpected checkout response.");
  }, []);

  useEffect(() => {
    if (!autoStart || cancelled) return;
    void startCheckout();
  }, [autoStart, cancelled, startCheckout]);

  return (
    <div className="auth-card">
      <p className="eyebrow">Subscribe</p>
      <h1>Venturo Membership</h1>
      <p className="lede muted">
        {PAID_PRICE} per month via Paystack. Cancel anytime by contacting us. The app can still
        use the App Store & Play Store.
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
        {pending ? "Opening Paystack" : `Subscribe · ${PAID_PRICE} / month`}
      </button>
      <p className="muted" style={{ marginTop: 16 }}>
        <a href="/account">Back to profile</a>
      </p>
    </div>
  );
}
