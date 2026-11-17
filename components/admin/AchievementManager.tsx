"use client";

import { useMemo, useState } from "react";
import {
  DraftPublishBar,
  MediaUploadField,
  ReorderList,
  StatusBadge,
  UnsavedGuard,
} from "@/components/admin/manage";
import { scheduleStatus } from "@/lib/control-room-schedule";
import type { AchievementAdmin } from "@/lib/wallet-types";

type Draft = AchievementAdmin & { dirty?: boolean; progressPolicy?: "preserve_earned" | "reset_progress" };

function summaryFor(item: Draft) {
  const count = Math.max(1, Number(item.criteria.count) || 1);
  if (item.criteria_kind === "attend_occurrences") {
    return `Earn this achievement after checking in to ${count} distinct Venturo event occurrence${count === 1 ? "" : "s"} (scanned attendance).`;
  }
  return `Earn this achievement after attending ${count} distinct Venturo event${count === 1 ? "" : "s"} (scanned attendance, not RSVP alone).`;
}

export function AchievementManager({ initial }: { initial: AchievementAdmin[] }) {
  const [items, setItems] = useState<Draft[]>(
    initial.map((item) => ({ ...item, progressPolicy: "preserve_earned" })),
  );
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const dirty = items.some((item) => item.dirty);
  const ordered = useMemo(
    () => [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [items],
  );
  const selected = items.find((item) => item.id === selectedId) ?? ordered[0] ?? null;

  function patch(id: string, change: Partial<Draft>) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...change, dirty: true };
        next.criteria_summary = summaryFor(next);
        return next;
      }),
    );
  }

  async function persist(item: Draft, status: "draft" | "published") {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/wallet/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id.startsWith("tmp-") ? undefined : item.id,
        name: item.name,
        description: item.description,
        imagePath: item.image_path,
        tier: item.tier,
        criteriaKind: item.criteria_kind,
        criteria: item.criteria,
        tokenReward: item.token_reward,
        sortOrder: item.sort_order,
        isActive: item.is_active,
        status,
        progressPolicy: item.progressPolicy ?? "preserve_earned",
      }),
    });
    const body = (await response.json()) as { error?: string; id?: string; criteriaSummary?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Could not save achievement.");
      return;
    }
    const nextId = body.id ?? item.id;
    setItems((current) =>
      current.map((row) =>
        row.id === item.id
          ? {
              ...row,
              id: nextId,
              status,
              dirty: false,
              criteria_summary: body.criteriaSummary ?? row.criteria_summary,
            }
          : row,
      ),
    );
    setSelectedId(nextId);
    setMessage(status === "published" ? "Achievement published." : "Draft saved.");
  }

  async function upload(item: Draft, file: File) {
    if (item.id.startsWith("tmp-")) {
      setMessage("Save a draft before uploading artwork.");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.set("achievementId", item.id);
    form.set("file", file);
    const response = await fetch("/api/admin/wallet/achievements/image", { method: "POST", body: form });
    const body = (await response.json()) as { error?: string; url?: string };
    setBusy(false);
    if (response.ok && body.url) {
      patch(item.id, { image_path: body.url, dirty: false });
      setMessage("Achievement image replaced.");
    } else {
      setMessage(body.error || "Could not upload image.");
    }
  }

  function addAchievement() {
    if (!newName.trim()) return;
    const id = `tmp-${Date.now()}`;
    const next: Draft = {
      id,
      key: id,
      name: newName.trim(),
      description: "",
      image_path: null,
      tier: "bronze",
      criteria_kind: "attend_events",
      criteria: { count: 3 },
      criteria_summary: "",
      token_reward: 0,
      sort_order: ordered.length + 1,
      status: "draft",
      is_active: true,
      updated_at: new Date().toISOString(),
      earned_count: 0,
      dirty: true,
      progressPolicy: "preserve_earned",
    };
    next.criteria_summary = summaryFor(next);
    setItems((current) => [...current, next]);
    setSelectedId(id);
    setNewName("");
  }

  return (
    <section className="cr-manage">
      <UnsavedGuard dirty={dirty} />
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">Wallet</p>
          <h1>Achievements</h1>
          <p className="lede muted">
            Criteria use scanned attendance only. Booking or RSVP alone does not count. Activity
            completion, interest-linked completion, bucket-list completion &amp; business visits are
            blocked until those signals exist.
          </p>
        </div>
      </header>

      <div className="form-grid cr-manage-create">
        <label className="field">
          <span>New achievement</span>
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="e.g. Weekend regular"
          />
        </label>
        <button className="btn btn-primary" type="button" onClick={addAchievement}>
          Add achievement
        </button>
      </div>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}

      {!selected ? (
        <p className="ops-empty">No achievements yet.</p>
      ) : (
        <div className="cr-manage-layout">
          <div className="cr-manage-main">
            <article className="studio-card">
              <p className="eyebrow">Library</p>
              <h2>Display order</h2>
              <ReorderList
                items={ordered.map((item) => ({ id: item.id, label: item.name }))}
                onReorder={(next) => {
                  setItems((current) =>
                    current.map((item) => {
                      const index = next.findIndex((row) => row.id === item.id);
                      if (index < 0 || item.sort_order === index + 1) return item;
                      return { ...item, sort_order: index + 1, dirty: true };
                    }),
                  );
                }}
                renderMeta={(row) => {
                  const item = items.find((entry) => entry.id === row.id);
                  if (!item) return null;
                  return (
                    <StatusBadge
                      status={scheduleStatus({
                        isActive: item.is_active,
                        startsAt: null,
                        endsAt: null,
                        isPublished: item.status === "published",
                      })}
                    />
                  );
                }}
              />
              <div className="cr-manage-row-tabs">
                {ordered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === selected.id ? "btn is-on" : "btn"}
                    onClick={() => setSelectedId(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </article>

            <article className="studio-card">
              <div className="cr-manage-option-head">
                <StatusBadge
                  status={scheduleStatus({
                    isActive: selected.is_active,
                    startsAt: null,
                    endsAt: null,
                    isPublished: selected.status === "published",
                  })}
                />
                <span className="muted">{selected.earned_count} earned</span>
              </div>
              <MediaUploadField
                label="Achievement image"
                url={selected.image_path}
                busy={busy}
                guidance={{
                  recommended: "Square 512 × 512 PNG or WebP.",
                  transparentOk: true,
                  maxMb: 1,
                }}
                onFile={(file) => void upload(selected, file)}
              />
              <div className="form-grid">
                <label className="field">
                  <span>Name</span>
                  <input
                    value={selected.name}
                    onChange={(event) => patch(selected.id, { name: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={selected.description ?? ""}
                    onChange={(event) => patch(selected.id, { description: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Tier</span>
                  <select
                    value={selected.tier ?? ""}
                    onChange={(event) => patch(selected.id, { tier: event.target.value || null })}
                  >
                    <option value="">None</option>
                    <option value="bronze">Bronze</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="platinum">Platinum</option>
                  </select>
                </label>
                <label className="field">
                  <span>Criteria</span>
                  <select
                    value={selected.criteria_kind}
                    onChange={(event) =>
                      patch(selected.id, {
                        criteria_kind: event.target.value as Draft["criteria_kind"],
                      })
                    }
                  >
                    <option value="attend_events">Attend N distinct events (scanned)</option>
                    <option value="attend_occurrences">
                      Check in to N distinct occurrences (scanned)
                    </option>
                  </select>
                </label>
                <label className="field">
                  <span>Required count</span>
                  <input
                    type="number"
                    min={1}
                    value={Number(selected.criteria.count) || 1}
                    onChange={(event) =>
                      patch(selected.id, {
                        criteria: {
                          ...selected.criteria,
                          count: Math.max(1, Number(event.target.value) || 1),
                        },
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Token reward (display only)</span>
                  <input
                    type="number"
                    min={0}
                    value={selected.token_reward}
                    onChange={(event) =>
                      patch(selected.id, { token_reward: Math.max(0, Number(event.target.value) || 0) })
                    }
                  />
                </label>
              </div>
              <p className="notice">{selected.criteria_summary}</p>
              <p className="muted">
                Unavailable until signals exist: complete activities, interest-linked completion,
                bucket-list completion, visit N distinct businesses.
              </p>
              <label className="field">
                <span>When criteria change</span>
                <select
                  value={selected.progressPolicy ?? "preserve_earned"}
                  onChange={(event) =>
                    patch(selected.id, {
                      progressPolicy: event.target.value as Draft["progressPolicy"],
                    })
                  }
                >
                  <option value="preserve_earned">
                    Preserve earned achievements (default — no double rewards)
                  </option>
                  <option value="reset_progress">Reset progress &amp; earned records</option>
                </select>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={selected.is_active}
                  onChange={(event) => patch(selected.id, { is_active: event.target.checked })}
                />
                <span>Active</span>
              </label>
              <DraftPublishBar
                status={scheduleStatus({
                  isActive: selected.is_active,
                  startsAt: null,
                  endsAt: null,
                  isPublished: selected.status === "published",
                })}
                dirty={Boolean(selected.dirty)}
                busy={busy}
                onSaveDraft={() => void persist(selected, "draft")}
                onPublish={() => void persist(selected, "published")}
              />
            </article>
          </div>
        </div>
      )}
    </section>
  );
}
