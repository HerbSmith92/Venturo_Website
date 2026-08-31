"use client";

import { useState } from "react";

export function ClaimRequestButton({
  listingName,
  listingSlug,
  userEmail,
  userName,
}: {
  listingName: string;
  listingSlug: string;
  userEmail?: string;
  userName?: string;
}) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!userEmail) {
      setError("Log in with an email to request a claim.");
      return;
    }
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("kind", "business");
    form.set("name", userName || userEmail.split("@")[0] || "Member");
    form.set("email", userEmail);
    form.set("businessName", listingName);
    form.set(
      "message",
      `Claim request for listing "${listingName}" (slug: ${listingSlug}). Please verify business ownership.`,
    );
    const response = await fetch("/api/contact", { method: "POST", body: form });
    setPending(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Could not send claim request.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return <p className="notice">Claim request sent to Control Room.</p>;
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending || !userEmail}
        onClick={onClick}
      >
        {pending ? "Please Wait" : "Request Claim"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
