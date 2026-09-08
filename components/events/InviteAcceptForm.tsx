"use client";

import { useState } from "react";

export function InviteAcceptForm({
  token,
  invite,
}: {
  token: string;
  invite: {
    kind: string;
    status: string;
    email: string;
    name: string;
    eventSlug: string;
  };
}) {
  const [name, setName] = useState(invite.name);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (invite.status === "accepted" || invite.status === "claimed" || invite.status === "booked" || code) {
    return (
      <p className="notice">
        You&apos;re on the list
        {code ? ` · ticket ${code}` : ""}. See you there.{" "}
        <a href={`/events/${invite.eventSlug}`}>Open the event</a>.
      </p>
    );
  }

  async function accept(submit: React.FormEvent) {
    submit.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const payload = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not accept.");
      setCode(payload.code ?? "issued");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not accept.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(submit) => void accept(submit)}>
      <p className="lede muted">Accept &amp; we issue a complimentary ticket.</p>
      <p className="muted">Saved for {invite.email}.</p>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(change) => setName(change.target.value)} required />
      </label>
      <label className="field">
        <span>Cellphone Number</span>
        <input
          value={phone}
          onChange={(change) => setPhone(change.target.value)}
          placeholder="082-123-4567"
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Accept RSVP"}
      </button>
    </form>
  );
}
