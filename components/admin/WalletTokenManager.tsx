"use client";

import { useState } from "react";
import { MediaUploadField, StatusBadge, UnsavedGuard } from "@/components/admin/manage";
import type { WalletTokenVersion } from "@/lib/wallet-types";

export function WalletTokenManager({
  published,
  drafts,
  history,
}: {
  published: WalletTokenVersion | null;
  drafts: WalletTokenVersion[];
  history: WalletTokenVersion[];
}) {
  const [currentPublished] = useState(published);
  const [selectedDraft, setSelectedDraft] = useState(drafts[0] ?? null);
  const [currentHistory] = useState(history);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("file", file);
    form.set("notes", notes);
    const response = await fetch("/api/admin/wallet/token/image", { method: "POST", body: form });
    const body = (await response.json()) as { error?: string; artwork?: WalletTokenVersion };
    setBusy(false);
    if (!response.ok || !body.artwork) {
      setMessage(body.error || "Could not upload token artwork.");
      return;
    }
    setSelectedDraft(body.artwork);
    setMessage("Draft token artwork saved. Publish when ready — balances stay untouched.");
  }

  async function act(action: "publish" | "restore" | "archive", id: string) {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/wallet/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Could not update token artwork.");
      return;
    }
    window.location.reload();
  }

  return (
    <section className="cr-manage">
      <UnsavedGuard dirty={false} />
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">Wallet</p>
          <h1>Token Image</h1>
          <p className="lede muted">
            Venturo token artwork for the member wallet. Publishing a replacement never changes
            balances or transaction history.
          </p>
        </div>
      </header>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}

      <div className="cr-manage-layout">
        <div className="cr-manage-main">
          <article className="studio-card">
            <div className="cr-manage-option-head">
              <StatusBadge status={currentPublished ? "active" : "draft"} label={currentPublished ? "Published" : "No published image"} />
            </div>
            <MediaUploadField
              label="Current / draft artwork"
              url={selectedDraft?.image_path ?? currentPublished?.image_path}
              busy={busy}
              guidance={{
                recommended: "Square 512 × 512 transparent PNG or WebP.",
                accept: "image/png,image/webp",
                transparentOk: true,
                maxMb: 1,
              }}
              onFile={(file) => void upload(file)}
            />
            <label className="field">
              <span>Draft notes</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional note for this version"
              />
            </label>
            {selectedDraft ? (
              <div className="cr-manage-publish-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void act("publish", selectedDraft.id)}
                >
                  Publish draft
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => void act("archive", selectedDraft.id)}
                >
                  Discard draft
                </button>
              </div>
            ) : null}
          </article>

          <article className="studio-card">
            <p className="eyebrow">History</p>
            <h2>Previous versions</h2>
            {currentHistory.length === 0 ? (
              <p className="ops-empty">No previous artwork yet.</p>
            ) : (
              <ul className="cr-manage-match-list">
                {currentHistory.map((row) => (
                  <li key={row.id}>
                    <div className="cr-manage-option-head">
                      <StatusBadge
                        status={row.status === "published" ? "active" : "inactive"}
                        label={row.status === "published" ? "Live" : "Archived"}
                      />
                    </div>
                    <img src={row.image_path} alt="" width={48} height={48} />
                    <strong>{row.notes || "Token artwork"}</strong>
                    <span className="muted">{new Date(row.created_at).toLocaleString("en-ZA")}</span>
                    {row.status !== "published" ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => void act("restore", row.id)}
                      >
                        Restore
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <aside className="cr-manage-aside">
          <article className="studio-card">
            <p className="eyebrow">Preview</p>
            <h2>Light &amp; dark</h2>
            <div className="cr-manage-media-previews">
              <span className="cr-manage-media-swatch is-light">
                <img
                  src={selectedDraft?.image_path ?? currentPublished?.image_path ?? "/brand/vee/venturo-activity-digital.png"}
                  alt=""
                  width={96}
                  height={96}
                />
              </span>
              <span className="cr-manage-media-swatch is-dark">
                <img
                  src={selectedDraft?.image_path ?? currentPublished?.image_path ?? "/brand/vee/venturo-activity-digital.png"}
                  alt=""
                  width={96}
                  height={96}
                />
              </span>
            </div>
            <p className="muted">Public endpoint: <code>/api/wallet/token</code></p>
          </article>
        </aside>
      </div>
    </section>
  );
}
