"use client";

import { useState } from "react";

export function ContactCard() {
  const [kind, setKind] = useState<"person" | "business">("person");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("sending");
    const form = event.currentTarget;
    const response = await fetch("/api/contact", {
      method: "POST",
      body: new FormData(form),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus("error");
      setError(payload.error ?? "Could not send that just now.");
      return;
    }
    setStatus("sent");
    form.reset();
  }

  return (
    <form className="contact-form-card" onSubmit={onSubmit}>
      <div className="kind-toggle" role="group" aria-label="Who is this from">
        <button
          type="button"
          className={kind === "person" ? "kind-btn active" : "kind-btn"}
          onClick={() => setKind("person")}
        >
          Message Us Today
        </button>
        <button
          type="button"
          className={kind === "business" ? "kind-btn active" : "kind-btn"}
          onClick={() => setKind("business")}
        >
          List A Business
        </button>
      </div>
      <input type="hidden" name="kind" value={kind} />
      <div className="field-row">
        <label className="field">
          <span>Your Name</span>
          <input name="name" type="text" autoComplete="name" required />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </div>
      <label className="field">
        <span>Phone</span>
        <input name="phone" type="tel" autoComplete="tel" placeholder="082 123 4567" />
      </label>
      {kind === "business" && (
        <div className="field-row">
          <label className="field">
            <span>Business Name</span>
            <input name="businessName" type="text" required />
          </label>
          <label className="field">
            <span>Area / Branch</span>
            <input name="area" type="text" placeholder="Sandton, Linden, Fourways…" />
          </label>
        </div>
      )}
      <label className="field">
        <span>How Can We Help?</span>
        <textarea
          name="message"
          rows={4}
          required
          placeholder={
            kind === "business"
              ? "What do you offer, where are you, & do you have a member discount in mind?"
              : "What would you like to know?"
          }
        />
      </label>
      {error && <p className="error">{error}</p>}
      {status === "sent" && <p className="notice">Got it. We will be in touch.</p>}
      <button className="btn btn-primary btn-block" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending" : "Send Message"}
      </button>
    </form>
  );
}
