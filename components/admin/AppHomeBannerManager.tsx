"use client";

import { useMemo, useState } from "react";
import {
  DraftPublishBar,
  MediaUploadField,
  PhonePreview,
  PhoneSizeToggle,
  ReorderList,
  ScheduleFields,
  StatusBadge,
  UnsavedGuard,
  type PhoneSize,
} from "@/components/admin/manage";
import {
  bannerLifecycleStatus,
  type AppHomeAdmin,
  type AppHomeBanner,
  type AppHomeScreen,
} from "@/lib/app-home-types";

type Draft = AppHomeBanner & { dirty?: boolean };

const DESTINATIONS = [
  { value: "none", label: "No destination" },
  { value: "activity", label: "Activity" },
  { value: "event", label: "Event" },
  { value: "community", label: "Community" },
  { value: "guide", label: "Guide" },
  { value: "external", label: "External link" },
];

const SCREEN_LABEL: Record<AppHomeScreen, string> = {
  discover: "Discover",
  events: "Events",
  community: "Community",
};

export function AppHomeBannerManager({
  screen,
  initial,
}: {
  screen: AppHomeScreen;
  initial: AppHomeAdmin;
}) {
  const [items, setItems] = useState<Draft[]>(initial.banners);
  const [selectedId, setSelectedId] = useState(initial.banners[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [phoneSize, setPhoneSize] = useState<PhoneSize>("standard");

  const dirty = items.some((item) => item.dirty);
  const ordered = useMemo(
    () => [...items].sort((a, b) => a.sort_order - b.sort_order || a.title?.localeCompare(b.title ?? "") || 0),
    [items],
  );
  const selected = items.find((item) => item.id === selectedId) ?? ordered[0] ?? null;

  function patch(id: string, change: Partial<Draft>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change, dirty: true } : item)),
    );
  }

  async function persist(item: Draft, status: "draft" | "published") {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/app-home/banner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id.startsWith("tmp-") ? undefined : item.id,
        screen,
        adminName: item.admin_name,
        title: item.title,
        supportingText: item.supporting_text,
        buttonLabel: item.button_label,
        imagePath: item.image_path,
        focalX: item.focal_x,
        focalY: item.focal_y,
        destinationKind: item.destination_kind,
        destinationId: item.destination_id,
        destinationUrl: item.destination_url,
        sortOrder: item.sort_order,
        isActive: item.is_active,
        startsAt: item.starts_at,
        endsAt: item.ends_at,
        status,
      }),
    });
    const body = (await response.json()) as { error?: string; id?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Could not save banner.");
      return;
    }
    const nextId = body.id ?? item.id;
    setItems((current) =>
      current.map((row) =>
        row.id === item.id
          ? { ...row, id: nextId, status, dirty: false, published_at: status === "published" ? new Date().toISOString() : row.published_at }
          : row,
      ),
    );
    setSelectedId(nextId);
    setMessage(status === "published" ? "Banner published." : "Draft saved.");
  }

  async function upload(item: Draft, file: File) {
    if (item.id.startsWith("tmp-")) {
      setMessage("Save a draft before uploading artwork.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("bannerId", item.id);
    form.set("file", file);
    const response = await fetch("/api/admin/app-home/banner/image", { method: "POST", body: form });
    const body = (await response.json()) as { error?: string; url?: string };
    setBusy(false);
    if (response.ok && body.url) {
      patch(item.id, { image_path: body.url, dirty: false });
      setMessage("Banner artwork replaced.");
    } else {
      setMessage(body.error || "Could not upload artwork.");
    }
  }

  function addBanner() {
    const id = `tmp-${Date.now()}`;
    const next: Draft = {
      id,
      screen,
      admin_name: "New banner",
      title: "",
      supporting_text: "",
      button_label: "Explore",
      image_path: null,
      focal_x: 0.5,
      focal_y: 0.5,
      destination_kind: "none",
      destination_id: null,
      destination_url: null,
      sort_order: ordered.length + 1,
      status: "draft",
      is_active: true,
      starts_at: null,
      ends_at: null,
      published_at: null,
      updated_at: new Date().toISOString(),
      dirty: true,
    };
    setItems((current) => [...current, next]);
    setSelectedId(id);
  }

  return (
    <section className="cr-manage">
      <UnsavedGuard dirty={dirty} />
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">Application View · {SCREEN_LABEL[screen]}</p>
          <h1>Banner</h1>
          <p className="lede muted">
            Carousel-ready banners with schedule, destination &amp; focal point. Times use
            Africa/Johannesburg.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={addBanner}>
          Add banner
        </button>
      </header>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}

      <div className="cr-manage-layout">
        <div className="cr-manage-main">
          <article className="studio-card">
            <p className="eyebrow">Order</p>
            <h2>Carousel sequence</h2>
            <ReorderList
              items={ordered.map((item) => ({
                id: item.id,
                label: item.admin_name || item.title || "Untitled banner",
              }))}
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
                return <StatusBadge status={bannerLifecycleStatus(item)} />;
              }}
            />
          </article>

          {selected ? (
            <article className="studio-card">
              <div className="cr-manage-option-head">
                <StatusBadge status={bannerLifecycleStatus(selected)} />
                {selected.dirty ? <span className="muted">Unsaved</span> : null}
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Admin name</span>
                  <input
                    value={selected.admin_name}
                    onChange={(event) => patch(selected.id, { admin_name: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Title</span>
                  <input
                    value={selected.title ?? ""}
                    onChange={(event) => patch(selected.id, { title: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Supporting text</span>
                  <textarea
                    rows={3}
                    value={selected.supporting_text ?? ""}
                    onChange={(event) =>
                      patch(selected.id, { supporting_text: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Button label</span>
                  <input
                    value={selected.button_label ?? ""}
                    onChange={(event) => patch(selected.id, { button_label: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Destination</span>
                  <select
                    value={selected.destination_kind ?? "none"}
                    onChange={(event) =>
                      patch(selected.id, { destination_kind: event.target.value })
                    }
                  >
                    {DESTINATIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {selected.destination_kind === "external" ? (
                  <label className="field">
                    <span>External URL</span>
                    <input
                      value={selected.destination_url ?? ""}
                      onChange={(event) =>
                        patch(selected.id, { destination_url: event.target.value })
                      }
                      placeholder="https://"
                    />
                  </label>
                ) : selected.destination_kind && selected.destination_kind !== "none" ? (
                  <label className="field">
                    <span>Destination ID</span>
                    <input
                      value={selected.destination_id ?? ""}
                      onChange={(event) =>
                        patch(selected.id, { destination_id: event.target.value || null })
                      }
                      placeholder="UUID of the target record"
                    />
                  </label>
                ) : null}
                <label className="field">
                  <span>Focal X (0–1)</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selected.focal_x}
                    onChange={(event) =>
                      patch(selected.id, { focal_x: Number(event.target.value) || 0.5 })
                    }
                  />
                </label>
                <label className="field">
                  <span>Focal Y (0–1)</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selected.focal_y}
                    onChange={(event) =>
                      patch(selected.id, { focal_y: Number(event.target.value) || 0.5 })
                    }
                  />
                </label>
              </div>
              <MediaUploadField
                label="Banner artwork"
                url={selected.image_path}
                busy={busy}
                showLightDark={false}
                guidance={{
                  recommended: "Recommended 1242 × 2208 (9:16) or 1242 × 1600. Keep subject near the focal point.",
                  maxMb: 3,
                  transparentOk: false,
                }}
                onFile={(file) => void upload(selected, file)}
              />
              <ScheduleFields
                value={{ startsAt: selected.starts_at, endsAt: selected.ends_at }}
                onChange={(value) =>
                  patch(selected.id, { starts_at: value.startsAt, ends_at: value.endsAt })
                }
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={selected.is_active}
                  onChange={(event) => patch(selected.id, { is_active: event.target.checked })}
                />
                <span>Active when published &amp; in schedule</span>
              </label>
              <DraftPublishBar
                status={bannerLifecycleStatus(selected)}
                dirty={Boolean(selected.dirty)}
                busy={busy}
                message={null}
                onSaveDraft={() => void persist(selected, "draft")}
                onPublish={() => void persist(selected, "published")}
              />
            </article>
          ) : (
            <p className="ops-empty">No banners yet. Add the first carousel slide.</p>
          )}
        </div>

        <aside className="cr-manage-aside">
          <PhoneSizeToggle value={phoneSize} onChange={setPhoneSize} />
          <PhonePreview label={`${SCREEN_LABEL[screen]} banner`} size={phoneSize}>
            <div className="cr-manage-banner-preview">
              {selected?.image_path ? (
                <img
                  src={selected.image_path}
                  alt=""
                  style={{
                    objectPosition: `${Number(selected.focal_x) * 100}% ${Number(selected.focal_y) * 100}%`,
                  }}
                />
              ) : (
                <div className="cr-manage-banner-empty">Upload artwork to preview</div>
              )}
              <div className="cr-manage-banner-copy">
                <strong>{selected?.title || "Banner title"}</strong>
                <p>{selected?.supporting_text || "Supporting line"}</p>
                {selected?.button_label ? <span>{selected.button_label}</span> : null}
              </div>
            </div>
          </PhonePreview>
        </aside>
      </div>
    </section>
  );
}
