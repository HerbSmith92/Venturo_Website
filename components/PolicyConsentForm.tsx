"use client";

import { useState } from "react";
import { PolicyConsent } from "@/components/PolicyConsent";

export function PolicyConsentForm({ next }: { next: string }) {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/auth/consent/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptTerms, acceptPrivacy, next }),
    });
    const payload = (await response.json()) as { error?: string; redirect?: string };
    if (!response.ok) {
      setPending(false);
      setError(payload.error ?? "Accept both policies to continue.");
      return;
    }
    window.location.href = payload.redirect ?? next;
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <PolicyConsent
        acceptTerms={acceptTerms}
        acceptPrivacy={acceptPrivacy}
        onTerms={setAcceptTerms}
        onPrivacy={setAcceptPrivacy}
      />
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Continue"}
      </button>
    </form>
  );
}
