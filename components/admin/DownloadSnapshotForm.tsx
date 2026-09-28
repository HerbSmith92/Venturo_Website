"use client";

import { useState } from "react";
import { formatClock } from "@/lib/control-room-shared";

function formatCount(n: number) {
  return new Intl.NumberFormat("en-ZA").format(n);
}

export function DownloadSnapshotForm({
  iosDownloads,
  androidDownloads,
  recordedAt,
}: {
  iosDownloads: number;
  androidDownloads: number;
  recordedAt: string | null;
}) {
  const [ios, setIos] = useState(String(iosDownloads));
  const [android, setAndroid] = useState(String(androidDownloads));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/analytics/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        iosDownloads: Number(ios),
        androidDownloads: Number(android),
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      iosDownloads?: number;
      androidDownloads?: number;
      recordedAt?: string;
    };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save downloads.");
      return;
    }
    if (payload.iosDownloads !== undefined) setIos(String(payload.iosDownloads));
    if (payload.androidDownloads !== undefined) setAndroid(String(payload.androidDownloads));
    setMessage(
      `Saved. iOS ${formatCount(payload.iosDownloads ?? 0)} · Android ${formatCount(payload.androidDownloads ?? 0)}.`,
    );
  }

  return (
    <form className="stack-list" onSubmit={onSubmit}>
      <div className="field-row">
        <label className="field">
          <span>iOS Downloads</span>
          <input
            inputMode="numeric"
            value={ios}
            onChange={(event) => setIos(event.target.value)}
            min={0}
            step={1}
          />
        </label>
        <label className="field">
          <span>Android Downloads</span>
          <input
            inputMode="numeric"
            value={android}
            onChange={(event) => setAndroid(event.target.value)}
            min={0}
            step={1}
          />
        </label>
      </div>
      <p className="muted">
        Paste lifetime totals only if the APIs are not connected. Daily bars
        come from store pulls, not this form. Automatic pulls refresh about
        every 6 hours, or tap Pull Store & RevenueCat.
        {recordedAt ? ` Last saved ${formatClock(recordedAt)}.` : ""}
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="notice">{message}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Save Store Totals"}
      </button>
    </form>
  );
}
