"use client";

import { useState, useTransition } from "react";
import { createGuideAuthorInvite, emailGuideAuthorInvite } from "@/app/admin/author-actions";

export function AuthorInvitePanel({
  authorId,
  takeoverName,
}: {
  authorId?: string;
  takeoverName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const takeover = Boolean(authorId);

  function onCopyLink() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = url
        ? { ok: true as const, url }
        : await createGuideAuthorInvite(authorId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUrl(result.url);
      try {
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
        setMessage("Link copied. Send it however you like — it lasts 14 days.");
      } catch {
        setCopied(false);
        setMessage("Link ready. Select it & copy.");
      }
    });
  }

  function onEmail() {
    setError(null);
    setMessage(null);
    setCopied(false);
    startTransition(async () => {
      const result = await emailGuideAuthorInvite(email, authorId, takeoverName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUrl(result.url);
      if (result.emailed) {
        setMessage(`Invite emailed to ${email.trim().toLowerCase()}.`);
      } else {
        setError(result.error ?? "Email did not send. Copy the link instead.");
      }
    });
  }

  return (
    <div className="cr-panel" style={{ marginBottom: takeover ? 0 : 28 }}>
      {takeover ? null : <h2>Invite a writer</h2>}
      <p className="muted">
        {takeover
          ? `They open the link, pick a username, get a one-time code, then take over this Author card. You still publish.`
          : "They open the link, pick a username, get a one-time code by email, then fill in their own Author card. You still publish."}
      </p>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="notice">{message}</p> : null}
      <div className="cr-grid-2">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="writer@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
      </div>
      <div className="cr-actions">
        <button className="btn btn-primary" type="button" onClick={onEmail} disabled={pending || !email.trim()}>
          {pending ? "Please wait" : "Email invite"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={onCopyLink} disabled={pending}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      {url ? (
        <label className="field">
          <span>Invite link (14 days)</span>
          <input readOnly value={url} />
        </label>
      ) : null}
    </div>
  );
}
