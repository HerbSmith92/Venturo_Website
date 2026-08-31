"use client";

import { useState } from "react";

type Step = "credentials" | "code";

export function AuthForm({
  mode,
  configured,
  next = "/account",
}: {
  mode: "login" | "signup";
  configured: boolean;
  next?: string;
}) {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function startWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("mode", mode);
    form.set("next", next);
    const response = await fetch("/auth/password/start", {
      method: "POST",
      body: form,
    });
    const payload = (await response.json()) as { error?: string; email?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not start sign-in.");
      return;
    }
    setEmail(payload.email ?? String(form.get("email") ?? ""));
    setFirstName(String(form.get("firstName") ?? firstName));
    setStep("code");
  }

  async function sendCode() {
    setError(null);
    setPending(true);
    const form = new FormData();
    form.set("email", email);
    form.set("mode", "login");
    form.set("next", next);
    if (firstName) form.set("firstName", firstName);
    const response = await fetch("/auth/otp/send", {
      method: "POST",
      body: form,
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not resend the code.");
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("email", email);
    form.set("firstName", firstName);
    form.set("next", next);
    const response = await fetch("/auth/otp/verify", {
      method: "POST",
      body: form,
    });
    const payload = (await response.json()) as { error?: string; redirect?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "That code did not work.");
      return;
    }
    window.location.href = payload.redirect ?? next;
  }

  if (step === "code") {
    return (
      <form className="auth-card" onSubmit={verifyCode}>
        <p className="eyebrow">Check Your Email</p>
        <h1>Confirm With Your Code</h1>
        <p className="lede muted">
          Password accepted for <strong>{email}</strong>. Enter the{" "}
          <strong>6-digit code</strong> we just emailed to finish signing in.
        </p>
        {!configured && (
          <p className="notice">
            Connect Supabase in `.env.local` to turn this form on.
          </p>
        )}
        <label className="field">
          <span>One-Time Code</span>
          <input
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,8}"
            minLength={6}
            maxLength={8}
            required
            autoFocus
            placeholder="123456"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={!configured || pending}>
          {pending ? "Please Wait" : "Verify & Continue"}
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          <button type="button" className="linkish" disabled={pending} onClick={() => sendCode()}>
            Resend code
          </button>
          {" · "}
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setStep("credentials");
              setError(null);
            }}
          >
            Back
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className="auth-card" onSubmit={startWithPassword}>
      <p className="eyebrow">{mode === "login" ? "Welcome Back" : "Create A Profile"}</p>
      <h1>{mode === "login" ? "Log In" : "Sign Up Free"}</h1>
      <p className="lede muted">
        {mode === "login"
          ? "Enter your email & password. We will email a one-time code to confirm it is you."
          : "Free lets you book event tickets. Choose a password, then confirm with a one-time code. Same email as the Venturo app."}
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
          <input
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </label>
      )}
      <label className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
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
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={!configured || pending}>
        {pending ? "Please Wait" : mode === "login" ? "Continue" : "Create Profile"}
      </button>
      <p className="muted" style={{ marginTop: 16 }}>
        {mode === "login" ? (
          <>
            <a href="/forgot-password">Forgot password?</a>
            {" · "}
            Need an account? <a href={`/signup?next=${encodeURIComponent(next)}`}>Sign Up</a>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <a href={`/login?next=${encodeURIComponent(next)}`}>Log In</a>
          </>
        )}
      </p>
    </form>
  );
}
