"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PrivacyTools() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function exportAccount() {
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/account/export");
    setPending(false);
    if (!response.ok) {
      setMessage("Could not export that account.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "venturo-account.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (!window.confirm("Delete this account? This cannot be undone.")) return;
    setPending(true);
    setMessage(null);
    const supabase = createClient();
    if (!supabase) {
      setMessage("Account deletion is not configured.");
      setPending(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!token || !base) {
      setMessage("Sign in again, then try once more.");
      setPending(false);
      return;
    }
    const response = await fetch(`${base}/functions/v1/delete-account`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setMessage(body.error ?? "Could not delete that account.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="hero-actions">
      <button className="btn btn-secondary" type="button" disabled={pending} onClick={() => void exportAccount()}>
        Export Account
      </button>
      <button className="btn btn-primary" type="button" disabled={pending} onClick={() => void deleteAccount()}>
        Delete Account
      </button>
      {message ? <p className="notice">{message}</p> : null}
    </div>
  );
}
