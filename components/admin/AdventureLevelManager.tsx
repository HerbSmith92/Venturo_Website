"use client";

import { useState } from "react";
import {
  MediaUploadField,
  PhonePreview,
  StatusBadge,
  UnsavedGuard,
} from "@/components/admin/manage";
import type { AdventureLevelAdmin, OnboardingCatalogAdmin } from "@/lib/onboarding-catalog-admin";
import { scheduleStatus } from "@/lib/control-room-schedule";

type Draft = AdventureLevelAdmin & { dirty?: boolean };

export function AdventureLevelManager({ catalog }: { catalog: OnboardingCatalogAdmin }) {
  const [items, setItems] = useState<Draft[]>(catalog.scales);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(catalog.scales[0]?.id ?? "");

  const dirty = items.some((item) => item.dirty);
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  function patch(id: string, change: Partial<Draft>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change, dirty: true } : item)),
    );
  }

  async function save(item: Draft) {
    setBusy(item.id);
    setMessage(null);
    const response = await fetch("/api/admin/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "scale",
        action: "save",
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        isActive: item.is_active,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(null);
    if (response.ok) {
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, dirty: false } : row)),
      );
      setMessage("Adventure level saved. Rank scoring is unchanged.");
    } else {
      setMessage(body.error || "Could not save adventure level.");
    }
  }

  async function upload(item: Draft, file: File) {
    setBusy(item.id);
    setMessage(null);
    const form = new FormData();
    form.set("entity", "scale");
    form.set("id", item.id);
    form.set("file", file);
    const response = await fetch("/api/admin/onboarding/image", { method: "POST", body: form });
    const body = (await response.json()) as { error?: string; url?: string };
    setBusy(null);
    if (response.ok && body.url) {
      patch(item.id, { image_path: body.url, dirty: false });
      setMessage("Image replaced.");
    } else {
      setMessage(body.error || "Could not upload image.");
    }
  }

  return (
    <section className="cr-manage">
      <UnsavedGuard dirty={dirty} />
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">Onboarding</p>
          <h1>Adventure Level</h1>
          <p className="lede muted">
            Five fixed ranks power listing scoring &amp; recommendations. Rename or restyle freely;
            changing the number of levels or their numeric meaning needs an explicit migration.
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
          <div className="grid">
            {items.map((item) => {
              const status = scheduleStatus({
                isActive: item.is_active,
                startsAt: null,
                endsAt: null,
              });
              return (
                <article
                  key={item.id}
                  className={`card cr-manage-option${selectedId === item.id ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="card-body">
                    <div className="cr-manage-option-head">
                      <StatusBadge status={status} />
                      <span className="muted">Rank {item.rank}</span>
                      {item.dirty ? <span className="muted">Unsaved</span> : null}
                    </div>
                    <MediaUploadField
                      label="Image"
                      url={item.image_path}
                      busy={busy === item.id}
                      guidance={{
                        recommended: "Square 512 × 512 PNG or WebP.",
                        transparentOk: true,
                        maxMb: 1,
                      }}
                      onFile={(file) => void upload(item, file)}
                    />
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={item.title}
                        onChange={(event) => patch(item.id, { title: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Description</span>
                      <textarea
                        rows={3}
                        value={item.subtitle}
                        onChange={(event) => patch(item.id, { subtitle: event.target.value })}
                      />
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={item.is_active}
                        onChange={(event) => patch(item.id, { is_active: event.target.checked })}
                      />
                      <span>Active for new members</span>
                    </label>
                    <p className="muted cr-manage-hint">
                      Underlying rank value stays {item.rank}. Listings already scored against this
                      stop keep working.
                    </p>
                    <button
                      className="btn btn-primary"
                      disabled={busy === item.id || !item.dirty}
                      onClick={() => void save(item)}
                    >
                      {busy === item.id ? "Saving…" : "Save level"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="cr-manage-aside">
          <PhonePreview label="Energy picker preview">
            <div className="cr-manage-chip-preview">
              <p className="eyebrow">Adventure Level</p>
              <div className="cr-manage-scale-list">
                {items
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.id === selected?.id ? "is-on" : undefined}
                    >
                      <strong>
                        {item.rank}. {item.title}
                      </strong>
                      <span>{item.subtitle}</span>
                    </button>
                  ))}
              </div>
            </div>
          </PhonePreview>
        </aside>
      </div>
    </section>
  );
}
