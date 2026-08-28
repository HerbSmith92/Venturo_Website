"use client";

import { useState } from "react";

export function AdminLoginForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/auth/admin-login", {
      method: "POST",
      body: form,
    });
    const payload = (await response.json()) as { error?: string; redirect?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Something went wrong.");
      return;
    }
    window.location.href = payload.redirect ?? "/admin";
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <img
        className="logo"
        src="/brand/logos/venturo-horizontal-light.svg"
        alt="Venturo"
        style={{ width: 160, marginBottom: 20 }}
      />
      <p className="eyebrow">Staff Only</p>
      <h1>Control Room</h1>
      <p className="lede muted">
        Use your invited admin login. There is no public sign-up for this portal.
      </p>
      {!configured && (
        <p className="notice">
          Connect Supabase in `.env.local` before staff can sign in.
        </p>
      )}
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={!configured || pending}>
        {pending ? "Please Wait" : "Log In"}
      </button>
    </form>
  );
}
