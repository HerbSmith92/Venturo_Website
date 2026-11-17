"use client";

import { useMemo, useState } from "react";
import {
  MediaUploadField,
  PhonePreview,
  ReorderList,
  StatusBadge,
  UnsavedGuard,
} from "@/components/admin/manage";
import type { CatalogAdmin, CatalogPersona } from "@/lib/catalog-admin";
import { scheduleStatus } from "@/lib/control-room-schedule";

type Draft = CatalogPersona & { dirty?: boolean };

export function PersonaManager({ catalog }: { catalog: CatalogAdmin }) {
  const [items, setItems] = useState<Draft[]>(catalog.personas);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [selectedId, setSelectedId] = useState(catalog.personas[0]?.id ?? "");

  const dirty = items.some((item) => item.dirty);
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const ordered = useMemo(
    () => [...items].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)),
    [items],
  );

  function patch(id: string, change: Partial<Draft>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change, dirty: true } : item)),
    );
  }

  async function save(item: Draft) {
    setBusy(item.id);
    setMessage(null);
    const response = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "persona",
        action: "save",
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        sortOrder: item.sort_order,
        isActive: item.is_active,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(null);
    if (response.ok) {
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, dirty: false } : row)),
      );
      setMessage("How You Go Out option saved.");
    } else {
      setMessage(body.error || "Could not save option.");
    }
  }

  async function upload(item: Draft, file: File) {
    setBusy(item.id);
    setMessage(null);
    const form = new FormData();
    form.set("personaId", item.id);
    form.set("file", file);
    const response = await fetch("/api/admin/personas/image", { method: "POST", body: form });
    const body = (await response.json()) as { error?: string; url?: string };
    setBusy(null);
    if (response.ok && body.url) {
      patch(item.id, { image_path: body.url, dirty: false });
      setMessage("Image replaced.");
    } else {
      setMessage(body.error || "Could not upload image.");
    }
  }

  async function createPersona() {
    if (!newTitle.trim()) return;
    setBusy("new");
    setMessage(null);
    const response = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "persona",
        action: "save",
        title: newTitle,
        subtitle: newSubtitle || newTitle,
        isActive: true,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(null);
    if (response.ok) window.location.reload();
    else setMessage(body.error || "Could not create option.");
  }

  function applyOrder(next: { id: string; label: string }[]) {
    setItems((current) =>
      current.map((item) => {
        const index = next.findIndex((row) => row.id === item.id);
        if (index < 0 || item.sort_order === index + 1) return item;
        return { ...item, sort_order: index + 1, dirty: true };
      }),
    );
  }

  return (
    <section className="cr-manage">
      <UnsavedGuard dirty={dirty} />
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">Onboarding</p>
          <h1>How You Go Out</h1>
          <p className="lede muted">
            Personas shown during sign-up &amp; profile. Deactivating hides an option from new
            members; existing selections &amp; recommendation links stay by ID.
          </p>
        </div>
      </header>

      <div className="form-grid cr-manage-create">
        <label className="field">
          <span>New option</span>
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="e.g. With Kids"
          />
        </label>
        <label className="field">
          <span>Short example</span>
          <input
            value={newSubtitle}
            onChange={(event) => setNewSubtitle(event.target.value)}
            placeholder="e.g. Parks, soft play, easy wins"
          />
        </label>
        <button className="btn btn-primary" disabled={busy === "new"} onClick={() => void createPersona()}>
          Add option
        </button>
      </div>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}

      <div className="cr-manage-layout">
        <div className="cr-manage-main">
          <article className="studio-card">
            <p className="eyebrow">Display order</p>
            <h2>Drag to reorder</h2>
            <ReorderList
              items={ordered.map((item) => ({ id: item.id, label: item.title }))}
              onReorder={applyOrder}
              renderMeta={(row) => {
                const item = items.find((entry) => entry.id === row.id);
                if (!item) return null;
                return (
                  <StatusBadge
                    status={scheduleStatus({ isActive: item.is_active, startsAt: null, endsAt: null })}
                  />
                );
              }}
            />
            <p className="muted cr-manage-hint">Save each changed option to keep the new order.</p>
          </article>

          <div className="grid">
            {ordered.map((item) => {
              const status = scheduleStatus({
                isActive: item.is_active,
                startsAt: null,
                endsAt: null,
              });
              return (
                <article
                  className={`card cr-manage-option${selectedId === item.id ? " is-selected" : ""}`}
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="card-body">
                    <div className="cr-manage-option-head">
                      <StatusBadge status={status} />
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
                    <label className="field">
                      <span>Display order</span>
                      <input
                        type="number"
                        min={1}
                        value={item.sort_order}
                        onChange={(event) =>
                          patch(item.id, { sort_order: Number(event.target.value) || 1 })
                        }
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
                    <button
                      className="btn btn-primary"
                      disabled={busy === item.id || !item.dirty}
                      onClick={() => void save(item)}
                    >
                      {busy === item.id ? "Saving…" : "Save option"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="cr-manage-aside">
          <PhonePreview label="Onboarding chip preview">
            <div className="cr-manage-chip-preview">
              <p className="eyebrow">How You Go Out</p>
              <div className="cr-manage-chips">
                {ordered
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.id === selected?.id ? "is-on" : undefined}
                    >
                      {item.image_path ? <img src={item.image_path} alt="" /> : null}
                      <span>{item.title}</span>
                    </button>
                  ))}
              </div>
              {selected ? (
                <p className="muted">{selected.subtitle || "No supporting line yet."}</p>
              ) : null}
            </div>
          </PhonePreview>
        </aside>
      </div>
    </section>
  );
}
