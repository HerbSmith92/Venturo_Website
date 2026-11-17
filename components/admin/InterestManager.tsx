"use client";

import { useState } from "react";
import type { CatalogAdmin, CatalogInterest } from "@/lib/catalog-admin";

const FALLBACK = "/brand/vee/venturo-activity-digital.png";

export function InterestManager({ catalog }: { catalog: CatalogAdmin }) {
  const [items, setItems] = useState(catalog.interests);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState(catalog.kinds[0]?.id ?? "");

  function patch(id: string, change: Partial<CatalogInterest>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }

  async function save(item: CatalogInterest) {
    setBusy(item.id);
    setMessage(null);
    const response = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "interest",
        action: "save",
        id: item.id,
        title: item.title,
        description: item.description,
        kindId: item.activity_kind_id,
        sortOrder: item.sort_order,
        isActive: item.is_active,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(null);
    setMessage(response.ok ? "Interest saved." : body.error || "Could not save interest.");
  }

  async function upload(item: CatalogInterest, file: File) {
    setBusy(item.id);
    setMessage(null);
    const form = new FormData();
    form.set("interestId", item.id);
    form.set("file", file);
    const response = await fetch("/api/admin/interests/icon", { method: "POST", body: form });
    const body = (await response.json()) as { error?: string; url?: string };
    setBusy(null);
    if (response.ok && body.url) patch(item.id, { icon_path: body.url });
    setMessage(response.ok ? "Icon replaced." : body.error || "Could not upload icon.");
  }

  async function createInterest() {
    if (!newTitle.trim() || !newKind) return;
    setBusy("new");
    const response = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "interest",
        action: "save",
        title: newTitle,
        kindId: newKind,
        isActive: true,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(null);
    if (response.ok) window.location.reload();
    else setMessage(body.error || "Could not create interest.");
  }

  return (
    <section className="studio-card" style={{ marginBottom: 32 }}>
      <p className="eyebrow">Catalogue management</p>
      <h2>Names, descriptions &amp; icons</h2>
      <p className="muted">
        Renaming or replacing an icon keeps the interest ID, linked content &amp; member selections.
        Inactive interests stay on existing profiles but disappear from new choices.
      </p>
      <div className="form-grid" style={{ marginBottom: 24 }}>
        <label className="field">
          <span>New interest</span>
          <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Interest name" />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={newKind} onChange={(event) => setNewKind(event.target.value)}>
            {catalog.kinds.map((kind) => <option key={kind.id} value={kind.id}>{kind.title}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" disabled={busy === "new"} onClick={() => void createInterest()}>
          Add interest
        </button>
      </div>
      {message ? <p className="notice" role="status">{message}</p> : null}
      <div className="grid">
        {items.map((item) => (
          <article className="card" key={item.id}>
            <div className="card-body">
              <div className="interest-icon-previews">
                <span style={{ background: "#EBEBF3", padding: 12 }}>
                  <img src={item.icon_path || FALLBACK} alt="" width={64} height={64} />
                </span>
                <span style={{ background: "#2A2D35", padding: 12 }}>
                  <img src={item.icon_path || FALLBACK} alt="" width={64} height={64} />
                </span>
              </div>
              <label className="field">
                <span>Name</span>
                <input value={item.title} onChange={(event) => patch(item.id, { title: event.target.value })} />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={item.description ?? ""}
                  onChange={(event) => patch(item.id, { description: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  value={item.activity_kind_id}
                  onChange={(event) => patch(item.id, { activity_kind_id: event.target.value })}
                >
                  {catalog.kinds.map((kind) => <option key={kind.id} value={kind.id}>{kind.title}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Display order</span>
                <input
                  type="number"
                  min={0}
                  value={item.sort_order}
                  onChange={(event) => patch(item.id, { sort_order: Number(event.target.value) || 0 })}
                />
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={item.is_active}
                  onChange={(event) => patch(item.id, { is_active: event.target.checked })}
                />
                <span>Active</span>
              </label>
              <label className="btn btn-secondary">
                Replace icon
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(item, file);
                  }}
                />
              </label>
              <button className="btn btn-primary" disabled={busy === item.id} onClick={() => void save(item)}>
                {busy === item.id ? "Saving…" : "Save interest"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
