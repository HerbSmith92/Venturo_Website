"use client";

import { useState } from "react";

export function AuthForm({
  mode,
  configured,
}: {
  mode: "login" | "signup";
  configured: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(mode === "login" ? "/auth/login" : "/auth/signup", {
      method: "POST",
      body: form,
    });
    const payload = (await response.json()) as { error?: string; redirect?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Something went wrong.");
      return;
    }
    window.location.href = payload.redirect ?? "/directory";
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <p className="eyebrow">{mode === "login" ? "Welcome Back" : "Create A Profile"}</p>
      <h1>{mode === "login" ? "Log In" : "Sign Up Free"}</h1>
      <p className="lede muted">
        {mode === "login"
          ? "Use the same account as the Venturo app."
          : "Free lets you book event tickets. Paid membership is confirmed by RevenueCat after you subscribe in the stores."}
      </p>
      {!configured && (
        <p className="notice">
          Connect Supabase in `.env.local` to turn this form on. The page is ready
          for `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
        </p>
      )}
      {mode === "signup" && (
        <label className="field">
          <span>First Name</span>
          <input name="firstName" type="text" autoComplete="given-name" required />
        </label>
      )}
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={!configured || pending}>
        {pending ? "Please Wait" : mode === "login" ? "Log In" : "Create Free Profile"}
      </button>
      <p className="muted" style={{ marginTop: 16 }}>
        {mode === "login" ? (
          <>
            Need an account? <a href="/signup">Sign Up</a>
          </>
        ) : (
          <>
            Already have an account? <a href="/login">Log In</a>
          </>
        )}
      </p>
    </form>
  );
}
