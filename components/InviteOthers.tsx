"use client";

import { useState } from "react";

export function InviteOthers({ title, path }: { title: string; path: string }) {
  const [note, setNote] = useState("");

  async function invite() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setNote("");
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied.");
    } catch {
      setNote(url);
    }
  }

  return (
    <span className="invite-others">
      <button type="button" className="btn btn-secondary" onClick={() => void invite()}>
        Invite others
      </button>
      {note ? <span className="muted">{note}</span> : null}
    </span>
  );
}
