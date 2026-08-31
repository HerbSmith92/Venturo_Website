"use client";

import { useState } from "react";

export function ForgotPasswordForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const response = await fetch("/auth/forgot-password", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not send the reset email.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="auth-card">
        <p className="eyebrow">Check Your Email</p>
        <h1>Reset Link Sent</h1>
        <p className="lede muted">
          If that email has a Venturo profile, you will get a link to set a new
          password. Then log in with your password & the one-time code.
        </p>
        <p className="muted" style={{ marginTop: 16 }}>
          <a href="/login">Back to log in</a>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <p className="eyebrow">Your Account</p>
      <h1>Forgot Password</h1>
      <p className="lede muted">
        Enter the email on your Venturo profile. We will send a link so you can
        set a password, then log in with password & a one-time code.
      </p>
      {!configured && (
        <p className="notice">
          Connect Supabase in `.env.local` to turn this form on.
        </p>
      )}
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required autoFocus />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={!configured || pending}>
        {pending ? "Please Wait" : "Email Reset Link"}
      </button>
      <p className="muted" style={{ marginTop: 16 }}>
        <a href="/login">Back to log in</a>
      </p>
    </form>
  );
}
