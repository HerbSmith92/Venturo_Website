"use client";

import { useMemo, useState } from "react";
import { AuthProviderIcon } from "@/components/AuthProviderIcon";
import { createClient } from "@/lib/supabase/client";

type Step = "methods" | "email" | "code";
type OAuthProvider = "google" | "apple" | "facebook";

const METHODS: {
  id: "email" | OAuthProvider;
  label: string;
  hint: string;
}[] = [
  { id: "email", label: "Email", hint: "One-time code to your inbox" },
  { id: "google", label: "Google", hint: "Continue with your Google account" },
  { id: "apple", label: "Apple", hint: "Continue with Apple" },
  // Facebook paused until Meta Developer account is unblocked.
  // { id: "facebook", label: "Facebook", hint: "Continue with Facebook" },
];

export function AuthForm({
  mode,
  configured,
  next = "/onboarding",
  initialError = null,
}: {
  mode: "login" | "signup";
  configured: boolean;
  next?: string;
  initialError?: string | null;
}) {
  const [step, setStep] = useState<Step>("methods");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null);

  const heading = useMemo(
    () => (mode === "login" ? "Log In" : "Sign Up Free"),
    [mode],
  );

  async function sendOtp(formMode: "login" | "signup" = mode) {
    setError(null);
    setPending(true);
    const form = new FormData();
    form.set("email", email.trim().toLowerCase());
    form.set("mode", formMode);
    form.set("next", next);
    if (firstName.trim()) form.set("firstName", firstName.trim());
    const response = await fetch("/auth/otp/send", {
      method: "POST",
      body: form,
    });
    const payload = (await response.json()) as { error?: string; email?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not send the code.");
      return false;
    }
    if (payload.email) setEmail(payload.email);
    return true;
  }

  async function startWithEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await sendOtp(mode);
    if (ok) setStep("code");
  }

  async function resendCode() {
    await sendOtp(mode);
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

  async function startOAuth(provider: OAuthProvider) {
    setError(null);
    if (!configured) {
      setError("Connect Supabase in `.env.local` to turn social login on.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not connected yet.");
      return;
    }
    setOauthPending(provider);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: false,
      },
    });
    if (oauthError) {
      setOauthPending(null);
      setError(
        oauthError.message.includes("provider is not enabled")
          ? `${provider[0].toUpperCase()}${provider.slice(1)} login is not enabled yet in Supabase Auth → Providers.`
          : oauthError.message,
      );
    }
  }

  function pickMethod(id: "email" | OAuthProvider) {
    setError(null);
    if (id === "email") {
      setStep("email");
      return;
    }
    void startOAuth(id);
  }

  if (step === "code") {
    return (
      <form key="auth-code" className="auth-card" onSubmit={verifyCode}>
        <p className="eyebrow">Check Your Email</p>
        <h1>Enter Your Code</h1>
        <p className="lede muted">
          We emailed a <strong>6-digit code</strong> to <strong>{email}</strong>.
          Type it here to continue — no password needed.
        </p>
        <label className="field">
          <span>One-Time Code</span>
          <input
            key={`otp-${email}`}
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,8}"
            minLength={6}
            maxLength={8}
            required
            autoFocus
            defaultValue=""
            placeholder="123456"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={!configured || pending}>
          {pending ? "Please Wait" : "Verify & Continue"}
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          <button type="button" className="linkish" disabled={pending} onClick={() => void resendCode()}>
            Resend code
          </button>
          {" · "}
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setStep("email");
              setError(null);
            }}
          >
            Use a different email
          </button>
        </p>
      </form>
    );
  }

  if (step === "email") {
    return (
      <form key="auth-email" className="auth-card" onSubmit={startWithEmail}>
        <p className="eyebrow">{mode === "login" ? "Welcome Back" : "Create A Profile"}</p>
        <h1>{heading}</h1>
        <p className="lede muted">
          {mode === "login"
            ? "Enter your email & we will send a one-time code."
            : "Enter your name & email — we will send a one-time code."}
        </p>
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
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={!configured || pending}>
          {pending ? "Please Wait" : "Email Me A Code"}
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setStep("methods");
              setError(null);
            }}
          >
            Other ways to {mode === "login" ? "log in" : "sign up"}
          </button>
        </p>
      </form>
    );
  }

  return (
    <div key="auth-methods" className="auth-card">
      <p className="eyebrow">{mode === "login" ? "Welcome Back" : "Create A Profile"}</p>
      <h1>{heading}</h1>
      <p className="lede muted">
        {mode === "login"
          ? "Pick how you want to get in. Same account across the website & the Venturo app."
          : "Pick how you want to join. Free lets you book event tickets — same email as the Venturo app."}
      </p>
      {!configured && (
        <p className="notice">
          Connect Supabase in `.env.local` to turn this form on.
        </p>
      )}
      <div className="auth-methods">
        {METHODS.map((method) => {
          const busy = method.id !== "email" && oauthPending === method.id;
          return (
            <button
              key={method.id}
              type="button"
              className={`auth-method auth-method-${method.id}`}
              disabled={!configured || Boolean(oauthPending)}
              onClick={() => pickMethod(method.id)}
            >
              <span className="auth-method-mark" aria-hidden>
                <AuthProviderIcon provider={method.id} />
              </span>
              <span className="auth-method-copy">
                <strong>{busy ? "Redirecting…" : method.label}</strong>
                <span>{method.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}
      <p className="muted" style={{ marginTop: 16 }}>
        {mode === "login" ? (
          <>
            Need an account? <a href={`/signup?next=${encodeURIComponent(next)}`}>Sign Up</a>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <a href={`/login?next=${encodeURIComponent(next)}`}>Log In</a>
          </>
        )}
      </p>
    </div>
  );
}
