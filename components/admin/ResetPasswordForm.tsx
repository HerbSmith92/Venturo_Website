"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";

function isOtpType(value: string | null): value is EmailOtpType {
  return (
    value === "recovery" ||
    value === "email" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "signup" ||
    value === "email_change"
  );
}

export function ResetPasswordForm({
  configured,
  mode = "staff",
}: {
  configured: boolean;
  mode?: "staff" | "member";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) setChecking(false);
        return;
      }

      const url = new URL(window.location.href);
      const presetError = url.searchParams.get("error");
      if (presetError) setError(presetError);

      const hashParams = new URLSearchParams(
        url.hash.startsWith("#") ? url.hash.slice(1) : url.hash,
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type") ?? hashParams.get("type");

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError && !cancelled) {
          setError(sessionError.message);
        }
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && !cancelled) {
          setError(exchangeError.message);
        }
      } else if (tokenHash && isOtpType(type)) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (otpError && !cancelled) {
          setError(otpError.message);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      setSessionReady(Boolean(data.session));
      setChecking(false);

      if (code || tokenHash || accessToken) {
        window.history.replaceState({}, "", url.pathname);
      }
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      setPending(false);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      setPending(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not connected yet.");
      setPending(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    window.location.href = mode === "member" ? "/login?next=/account" : "/admin";
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <img
        className="logo"
        src="/brand/logos/venturo-horizontal-light.svg"
        alt="Venturo"
        style={{ width: 160, marginBottom: 20 }}
      />
      <p className="eyebrow">{mode === "member" ? "Your Account" : "Staff Only"}</p>
      <h1>Set Your Password</h1>
      <p className="lede muted">
        {mode === "member"
          ? "Open this page from the reset email in this tab. After you save, staff can log in with the new password on the admin login page."
          : "Open this page from the reset email in this tab. Localhost or 127.0.0.1 both work — stay on whatever the email opens."}
      </p>
      {!configured && (
        <p className="notice">Connect Supabase in `.env.local` first.</p>
      )}
      {checking && <p className="muted">Checking the reset link…</p>}
      {!checking && !sessionReady && (
        <p className="notice">
          No reset session yet. Click the new email link once. Do not paste
          this page’s URL yourself.
        </p>
      )}
      <label className="field">
        <span>New Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={!sessionReady}
        />
      </label>
      <label className="field">
        <span>Confirm Password</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={!sessionReady}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button
        className="btn btn-primary"
        type="submit"
        disabled={!configured || !sessionReady || pending}
      >
        {pending ? "Please Wait" : "Save Password"}
      </button>
    </form>
  );
}
