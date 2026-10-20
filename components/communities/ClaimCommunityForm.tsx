"use client";

import { useState } from "react";

export function ClaimCommunityForm({
  communityId,
  communityTitle,
  communitySlug,
  configured,
}: {
  communityId: string;
  communityTitle: string;
  communitySlug: string;
  configured: boolean;
}) {
  const [step, setStep] = useState<"account" | "code">("account");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    const confirm = String(new FormData(event.currentTarget).get("confirm") ?? "");
    if (confirm !== password) {
      setError("Those passwords do not match.");
      return;
    }
    setPending(true);
    const form = new FormData();
    form.set("email", email.trim().toLowerCase());
    form.set("mode", "signup");
    form.set("firstName", firstName.trim());
    const response = await fetch("/auth/otp/send", { method: "POST", body: form });
    const payload = (await response.json()) as { error?: string; email?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not send the code.");
      return;
    }
    if (payload.email) setEmail(payload.email);
    setStep("code");
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("email", email);
    form.set("password", password);
    form.set("firstName", firstName.trim());
    form.set("communityId", communityId);
    const response = await fetch("/auth/community-claim/verify", { method: "POST", body: form });
    const payload = (await response.json()) as { error?: string; redirect?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "That code did not work.");
      return;
    }
    window.location.href = payload.redirect ?? `/account/communities/${communityId}`;
  }

  if (step === "code") {
    return (
      <form className="auth-card" onSubmit={verify}>
        <p className="eyebrow">Check Your Email</p>
        <h1>Enter Your Code</h1>
        <p className="lede muted">
          We emailed a 6-digit code to <strong>{email}</strong>. Type it here to claim {communityTitle}.
        </p>
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
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Please Wait" : "Verify & Claim"}
        </button>
      </form>
    );
  }

  return (
    <form className="auth-card" onSubmit={sendCode}>
      <p className="eyebrow">Claim</p>
      <h1>Create Your Account</h1>
      <p className="lede muted">
        Set a password for {communityTitle}, then we email a one-time code. After that you can edit the community & add events.
      </p>
      <label className="field">
        <span>First Name</span>
        <input
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
      </label>
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
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Confirm Password</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      {error ? <p className="error">{error}</p> : null}
      {!configured ? <p className="notice">Connect Supabase in `.env.local` to turn this form on.</p> : null}
      <button className="btn btn-primary" type="submit" disabled={!configured || pending}>
        {pending ? "Please Wait" : "Email Me A Code"}
      </button>
      <p className="muted" style={{ marginTop: 16 }}>
        Already have an account?{" "}
        <a href={`/login?next=/communities/${communitySlug}/claim`}>Log In</a>
      </p>
    </form>
  );
}
