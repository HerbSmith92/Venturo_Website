"use client";

import { useState } from "react";
import { OtpCodeBoxes } from "@/components/OtpCodeBoxes";
import { PolicyConsent } from "@/components/PolicyConsent";
import { CONSENT_REQUIRED } from "@/lib/policy-consent";

type Step = "details" | "code";

export function AuthorJoinAuth({
  configured,
  next,
  suggestedEmail = "",
}: {
  configured: boolean;
  next: string;
  suggestedEmail?: string;
}) {
  const [step, setStep] = useState<Step>("details");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(suggestedEmail);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  async function sendOtp() {
    setError(null);
    setPending(true);
    const form = new FormData();
    form.set("email", email.trim().toLowerCase());
    form.set("mode", mode);
    form.set("next", next);
    form.set("intent", "author");
    if (mode === "signup") {
      form.set("firstName", username.trim());
      if (!acceptTerms || !acceptPrivacy) {
        setPending(false);
        setError(CONSENT_REQUIRED);
        return false;
      }
      form.set("acceptTerms", "on");
      form.set("acceptPrivacy", "on");
    }
    const response = await fetch("/auth/otp/send", { method: "POST", body: form });
    const payload = (await response.json()) as { error?: string; email?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not send the code.");
      return false;
    }
    if (payload.email) setEmail(payload.email);
    return true;
  }

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "signup" && !username.trim()) {
      setError("Username is required.");
      return;
    }
    const ok = await sendOtp();
    if (ok) setStep("code");
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("email", email.trim().toLowerCase());
    form.set("next", next);
    form.set("intent", "author");
    if (mode === "signup") {
      form.set("firstName", username.trim());
      form.set("mode", "signup");
      if (acceptTerms) form.set("acceptTerms", "on");
      if (acceptPrivacy) form.set("acceptPrivacy", "on");
    }
    const response = await fetch("/auth/otp/verify", { method: "POST", body: form });
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
      <form key="author-code" className="auth-card" onSubmit={(event) => void verifyCode(event)} autoComplete="off">
        <p className="eyebrow">Check Your Email</p>
        <h2>Enter Your Code</h2>
        <p className="lede muted">
          We emailed a <strong>6-digit code</strong> to <strong>{email}</strong>. Type it here —
          no password needed.
        </p>
        {username ? (
          <input type="text" name="username" autoComplete="username" defaultValue={username} tabIndex={-1} aria-hidden="true" className="sr-only" readOnly />
        ) : null}
        <label className="field">
          <span>One-Time Code</span>
          <OtpCodeBoxes key={`otp-${email}`} disabled={pending} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={!configured || pending}>
          {pending ? "Please wait" : "Verify & continue"}
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          <button type="button" className="linkish" disabled={pending} onClick={() => void sendOtp()}>
            Resend code
          </button>
          {" · "}
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setStep("details");
              setError(null);
            }}
          >
            Use a different email
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className="auth-card" onSubmit={(event) => void start(event)}>
      <p className="eyebrow">{mode === "signup" ? "Create A Profile" : "Welcome Back"}</p>
      <h2>{mode === "signup" ? "Pick a username" : "Log in"}</h2>
      <p className="lede muted">
        {mode === "signup"
          ? "Choose a username, then we email you a one-time code. After that you fill in your Author card."
          : "Enter your email & we will send a one-time code."}
      </p>
      {mode === "signup" ? (
        <label className="field">
          <span>Username</span>
          <input
            name="username"
            type="text"
            autoComplete="nickname"
            required
            maxLength={80}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="How you want to appear on Guides"
          />
        </label>
      ) : null}
      <label className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {mode === "signup" ? (
        <PolicyConsent
          acceptTerms={acceptTerms}
          acceptPrivacy={acceptPrivacy}
          onTerms={setAcceptTerms}
          onPrivacy={setAcceptPrivacy}
        />
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={!configured || pending}>
        {pending ? "Please wait" : "Email me a code"}
      </button>
      <p className="muted" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="linkish"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError(null);
          }}
        >
          {mode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
        </button>
      </p>
    </form>
  );
}
