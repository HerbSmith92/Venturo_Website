"use client";

import { useEffect, useState } from "react";
import {
  MediaUploadField,
  PhonePreview,
  ReorderList,
  StatusBadge,
  UnsavedGuard,
} from "@/components/admin/manage";
import {
  bucketRuleSummary,
  type BucketItemAdmin,
  type OnboardingCatalogAdmin,
} from "@/lib/onboarding-catalog-admin";
import { scheduleStatus } from "@/lib/control-room-schedule";

type Draft = BucketItemAdmin & { dirty?: boolean };

type PreviewMatch = {
  id: string;
  title: string;
  subtitle: string | null;
  why: string;
};

export function BucketListManager({ catalog }: { catalog: OnboardingCatalogAdmin }) {
  const [items, setItems] = useState<Draft[]>(catalog.bucketItems);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(catalog.bucketItems[0]?.id ?? "");
  const [preview, setPreview] = useState<PreviewMatch[]>([]);
  const [previewSummary, setPreviewSummary] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newInterest, setNewInterest] = useState(catalog.interests[0]?.id ?? "");
  const [newKind, setNewKind] = useState(catalog.kinds[0]?.id ?? "");
  const [newRank, setNewRank] = useState(2);

  const dirty = items.some((item) => item.dirty);
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));

  function patch(id: string, change: Partial<Draft>) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...change, dirty: true };
        if (change.interest_id) {
          const interest = catalog.interests.find((row) => row.id === change.interest_id);
          next.interest_title = interest?.title ?? next.interest_title;
        }
        if (change.activity_kind_id) {
          const kind = catalog.kinds.find((row) => row.id === change.activity_kind_id);
          next.kind_title = kind?.title ?? next.kind_title;
        }
        return next;
      }),
    );
  }

  useEffect(() => {
    if (!selected) {
      setPreview([]);
      setPreviewSummary("");
      return;
    }
    const controller = new AbortController();
    void (async () => {
      const response = await fetch(
        `/api/admin/onboarding/bucket-preview?interestId=${encodeURIComponent(selected.interest_id)}&minRank=${selected.typical_scale_rank}`,
        { signal: controller.signal },
      );
      const body = (await response.json()) as {
        matches?: PreviewMatch[];
        summary?: string;
        error?: string;
      };
      if (!response.ok) {
        setPreview([]);
        setPreviewSummary(body.error || "Could not preview matches.");
        return;
      }
      setPreview(body.matches ?? []);
      setPreviewSummary(body.summary || bucketRuleSummary(selected));
    })();
    return () => controller.abort();
  }, [selected?.id, selected?.interest_id, selected?.typical_scale_rank]);

  async function save(item: Draft) {
    setBusy(item.id);
    setMessage(null);
    const response = await fetch("/api/admin/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "bucket",
        action: "save",
        id: item.id,
        title: item.title,
        description: item.description,
        interestId: item.interest_id,
        kindId: item.activity_kind_id,
        typicalScaleRank: item.typical_scale_rank,
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
      setMessage(
        "Bucket option saved. Member selections & completion history keep their existing IDs.",
      );
    } else {
      setMessage(body.error || "Could not save bucket option.");
    }
  }

  async function upload(item: Draft, file: File) {
    setBusy(item.id);
    setMessage(null);
    const form = new FormData();
    form.set("entity", "bucket");
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

  async function createItem() {
    if (!newTitle.trim() || !newInterest || !newKind) return;
    setBusy("new");
    setMessage(null);
    const response = await fetch("/api/admin/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "bucket",
        action: "save",
        title: newTitle,
        interestId: newInterest,
        kindId: newKind,
        typicalScaleRank: newRank,
        isActive: true,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(null);
    if (response.ok) window.location.reload();
    else setMessage(body.error || "Could not create bucket option.");
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
          <h1>Bucket List</h1>
          <p className="lede muted">
            Options members pick during onboarding, plus the rules that decide which activities
            qualify. Editing rules never deletes <code>profile_bucket_items</code> selections.
          </p>
        </div>
      </header>

      <div className="form-grid cr-manage-create">
        <label className="field">
          <span>New option</span>
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="e.g. Catch a Blouberg sunset"
          />
        </label>
        <label className="field">
          <span>Interest</span>
          <select value={newInterest} onChange={(event) => setNewInterest(event.target.value)}>
            {catalog.interests.map((interest) => (
              <option key={interest.id} value={interest.id}>
                {interest.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Category</span>
          <select value={newKind} onChange={(event) => setNewKind(event.target.value)}>
            {catalog.kinds.map((kind) => (
              <option key={kind.id} value={kind.id}>
                {kind.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Min adventure level</span>
          <input
            type="number"
            min={1}
            max={5}
            value={newRank}
            onChange={(event) => setNewRank(Number(event.target.value) || 1)}
          />
        </label>
        <button className="btn btn-primary" disabled={busy === "new"} onClick={() => void createItem()}>
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
            />
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
                  key={item.id}
                  className={`card cr-manage-option${selectedId === item.id ? " is-selected" : ""}`}
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
                        recommended: "4:5 or square PNG / WebP.",
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
                        value={item.description ?? ""}
                        onChange={(event) => patch(item.id, { description: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Interest</span>
                      <select
                        value={item.interest_id}
                        onChange={(event) => patch(item.id, { interest_id: event.target.value })}
                      >
                        {catalog.interests.map((interest) => (
                          <option key={interest.id} value={interest.id}>
                            {interest.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Category</span>
                      <select
                        value={item.activity_kind_id}
                        onChange={(event) =>
                          patch(item.id, { activity_kind_id: event.target.value })
                        }
                      >
                        {catalog.kinds.map((kind) => (
                          <option key={kind.id} value={kind.id}>
                            {kind.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Min adventure level</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={item.typical_scale_rank}
                        onChange={(event) =>
                          patch(item.id, {
                            typical_scale_rank: Math.min(
                              5,
                              Math.max(1, Number(event.target.value) || 1),
                            ),
                          })
                        }
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
                    <p className="notice">{bucketRuleSummary(item)}</p>
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
          <PhonePreview label="Bucket list preview">
            <div className="cr-manage-chip-preview">
              <p className="eyebrow">Bucket List</p>
              <div className="cr-manage-scale-list">
                {ordered
                  .filter((item) => item.is_active)
                  .slice(0, 6)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.id === selected?.id ? "is-on" : undefined}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.interest_title}</span>
                    </button>
                  ))}
              </div>
            </div>
          </PhonePreview>

          <article className="studio-card" style={{ marginTop: 16 }}>
            <p className="eyebrow">Matching activities</p>
            <h2>Live preview</h2>
            <p className="muted">{previewSummary || "Select an option to preview matches."}</p>
            {preview.length === 0 ? (
              <p className="ops-empty">No qualifying live listings yet.</p>
            ) : (
              <ul className="cr-manage-match-list">
                {preview.map((match) => (
                  <li key={match.id}>
                    <strong>{match.title}</strong>
                    {match.subtitle ? <span className="muted">{match.subtitle}</span> : null}
                    <span className="muted">{match.why}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted cr-manage-hint">
              Qualifying ≠ selected ≠ completed. Members keep their picks when rules change; review
              matches after big interest or level edits.
            </p>
          </article>
        </aside>
      </div>
    </section>
  );
}
