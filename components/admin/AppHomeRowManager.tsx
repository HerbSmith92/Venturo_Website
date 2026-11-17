"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ContentPicker,
  DraftPublishBar,
  PhonePreview,
  ReorderList,
  ScheduleFields,
  StatusBadge,
  UnsavedGuard,
  type ContentPick,
} from "@/components/admin/manage";
import {
  automaticRuleOptions,
  primaryItemKindForScreen,
  type AppHomeContentCard,
} from "@/lib/app-home-content-client";
import {
  rowLifecycleStatus,
  type AppHomeAdmin,
  type AppHomeRow,
  type AppHomeScreen,
} from "@/lib/app-home-types";

type Draft = AppHomeRow & { dirty?: boolean };
type Mode = "hot" | "featured" | "custom";

const SCREEN_LABEL: Record<AppHomeScreen, string> = {
  discover: "Discover",
  events: "Events",
  community: "Community",
};

function emptyCustom(screen: AppHomeScreen, sortOrder: number): Draft {
  return {
    id: `tmp-${Date.now()}`,
    screen,
    row_kind: "custom",
    admin_name: "Seasonal row",
    public_title: "",
    public_description: "",
    selection_mode: "manual",
    selection_rules: {},
    max_items: 12,
    view_all_kind: "none",
    view_all_id: null,
    view_all_url: null,
    sort_order: sortOrder,
    status: "draft",
    is_active: true,
    starts_at: null,
    ends_at: null,
    published_at: null,
    updated_at: new Date().toISOString(),
    items: [],
    dirty: true,
  };
}

export function AppHomeRowManager({
  screen,
  mode,
  initial,
  interests = [],
}: {
  screen: AppHomeScreen;
  mode: Mode;
  initial: AppHomeAdmin;
  interests?: { id: string; title: string }[];
}) {
  const seedRows =
    mode === "custom"
      ? initial.rows.filter((row) => row.row_kind === "custom")
      : initial.rows.filter((row) => row.row_kind === mode);

  const [rows, setRows] = useState<Draft[]>(seedRows);
  const [selectedId, setSelectedId] = useState(seedRows[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ContentPick[]>([]);
  const [preview, setPreview] = useState<AppHomeContentCard[]>([]);

  const dirty = rows.some((row) => row.dirty);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
  const itemKind = primaryItemKindForScreen(screen);
  const autoRules = automaticRuleOptions(screen);

  const title =
    mode === "hot" ? "Hot on Venturo" : mode === "featured" ? "Featured" : "Add Row Listing";

  const orderedSelectedItems = useMemo(() => {
    if (!selected) return [];
    return [...selected.items].sort((a, b) => a.sort_order - b.sort_order);
  }, [selected]);

  function patch(id: string, change: Partial<Draft>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...change, dirty: true } : row)),
    );
  }

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const response = await fetch(
        `/api/admin/app-home/content?screen=${screen}&mode=search&maxItems=40`,
        { signal: controller.signal },
      );
      const body = (await response.json()) as { items?: AppHomeContentCard[] };
      setCatalog(
        (body.items ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          imageUrl: item.imageUrl,
          meta: item.meta,
        })),
      );
    })();
    return () => controller.abort();
  }, [screen]);

  useEffect(() => {
    if (!selected) {
      setPreview([]);
      return;
    }
    const controller = new AbortController();
    void (async () => {
      if (selected.selection_mode === "automatic") {
        const response = await fetch(
          `/api/admin/app-home/content?screen=${screen}&mode=automatic&maxItems=${selected.max_items}&rules=${encodeURIComponent(JSON.stringify(selected.selection_rules ?? {}))}`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as { items?: AppHomeContentCard[] };
        setPreview(body.items ?? []);
        return;
      }
      if (selected.selection_mode === "filter") {
        const response = await fetch(
          `/api/admin/app-home/content?screen=${screen}&mode=filter&maxItems=${selected.max_items}&rules=${encodeURIComponent(JSON.stringify(selected.selection_rules ?? {}))}`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as { items?: AppHomeContentCard[] };
        setPreview(body.items ?? []);
        return;
      }
      const ids = orderedSelectedItems.map((item) => item.item_id);
      const cards = catalog.filter((item) => ids.includes(item.id));
      const missing = ids.filter((id) => !cards.some((card) => card.id === id));
      setPreview([
        ...ids
          .map((id) => {
            const card = cards.find((entry) => entry.id === id);
            if (!card) return null;
            return {
              id: card.id,
              kind: itemKind,
              title: card.title,
              subtitle: card.subtitle ?? null,
              imageUrl: card.imageUrl ?? null,
              meta: card.meta ?? null,
              available: true,
            } satisfies AppHomeContentCard;
          })
          .filter(Boolean) as AppHomeContentCard[],
        ...missing.map((id) => ({
          id,
          kind: itemKind,
          title: "Selected item",
          subtitle: id,
          imageUrl: null,
          meta: "Save to refresh details",
          available: true,
        })),
      ]);
    })();
    return () => controller.abort();
  }, [
    selected?.id,
    selected?.selection_mode,
    selected?.selection_rules,
    selected?.max_items,
    orderedSelectedItems,
    catalog,
    screen,
    itemKind,
  ]);

  async function persist(row: Draft, status: "draft" | "published") {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/app-home/row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: row.id.startsWith("tmp-") ? undefined : row.id,
        screen,
        rowKind: row.row_kind,
        adminName: row.admin_name,
        publicTitle: row.public_title,
        publicDescription: row.public_description,
        selectionMode: row.selection_mode,
        selectionRules: row.selection_rules,
        maxItems: row.max_items,
        viewAllKind: row.view_all_kind,
        viewAllId: row.view_all_id,
        viewAllUrl: row.view_all_url,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status,
        items: row.items.map((item, index) => ({
          itemId: item.item_id,
          itemKind: item.item_kind,
          sortOrder: index + 1,
          startsAt: item.starts_at,
          endsAt: item.ends_at,
        })),
      }),
    });
    const body = (await response.json()) as { error?: string; id?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Could not save row.");
      return;
    }
    const nextId = body.id ?? row.id;
    setRows((current) =>
      current.map((entry) =>
        entry.id === row.id
          ? {
              ...entry,
              id: nextId,
              status,
              dirty: false,
              published_at: status === "published" ? new Date().toISOString() : entry.published_at,
            }
          : entry,
      ),
    );
    setSelectedId(nextId);
    setMessage(status === "published" ? "Row published." : "Draft saved.");
  }

  async function archive(row: Draft) {
    if (row.id.startsWith("tmp-")) {
      setRows((current) => current.filter((entry) => entry.id !== row.id));
      return;
    }
    setBusy(true);
    const response = await fetch("/api/admin/app-home/row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", id: row.id, screen }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Could not archive row.");
      return;
    }
    setRows((current) => current.filter((entry) => entry.id !== row.id));
    setMessage("Row archived.");
  }

  async function duplicate(row: Draft) {
    if (row.id.startsWith("tmp-")) return;
    setBusy(true);
    const response = await fetch("/api/admin/app-home/row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", id: row.id, screen }),
    });
    const body = (await response.json()) as { error?: string; id?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Could not duplicate row.");
      return;
    }
    window.location.reload();
  }

  function toggleItem(id: string) {
    if (!selected) return;
    const exists = selected.items.some((item) => item.item_id === id);
    if (exists) {
      patch(selected.id, {
        items: selected.items.filter((item) => item.item_id !== id),
      });
      return;
    }
    patch(selected.id, {
      items: [
        ...selected.items,
        {
          id: `item-${id}`,
          row_id: selected.id,
          item_kind: itemKind,
          item_id: id,
          sort_order: selected.items.length + 1,
          starts_at: null,
          ends_at: null,
        },
      ],
    });
  }

  return (
    <section className="cr-manage">
      <UnsavedGuard dirty={dirty} />
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">Application View · {SCREEN_LABEL[screen]}</p>
          <h1>{title}</h1>
          <p className="lede muted">
            {mode === "hot"
              ? "Hot is automatic by default. Switch to manual curation when you need a fixed list."
              : mode === "featured"
                ? "Curate featured listings for this screen. Unpublished content is excluded from the public feed."
                : "Seasonal & custom rows — Christmas, school holidays, Valentine’s, and more."}
          </p>
        </div>
        {mode === "custom" ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              const next = emptyCustom(screen, rows.length + 100);
              setRows((current) => [...current, next]);
              setSelectedId(next.id);
            }}
          >
            Add row
          </button>
        ) : null}
      </header>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}

      {!selected ? (
        <p className="ops-empty">No rows yet.</p>
      ) : (
        <div className="cr-manage-layout">
          <div className="cr-manage-main">
            {mode === "custom" ? (
              <article className="studio-card">
                <p className="eyebrow">Rows</p>
                <h2>Custom collections</h2>
                <ReorderList
                  items={rows
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((row) => ({
                      id: row.id,
                      label: row.admin_name || row.public_title || "Untitled row",
                    }))}
                  onReorder={(next) => {
                    setRows((current) =>
                      current.map((row) => {
                        const index = next.findIndex((entry) => entry.id === row.id);
                        if (index < 0 || row.sort_order === index + 100) return row;
                        return { ...row, sort_order: index + 100, dirty: true };
                      }),
                    );
                  }}
                  renderMeta={(entry) => {
                    const row = rows.find((item) => item.id === entry.id);
                    if (!row) return null;
                    return <StatusBadge status={rowLifecycleStatus(row)} />;
                  }}
                />
                <div className="cr-manage-row-tabs">
                  {rows
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className={row.id === selected.id ? "btn is-on" : "btn"}
                        onClick={() => setSelectedId(row.id)}
                      >
                        {row.admin_name || row.public_title || "Untitled"}
                      </button>
                    ))}
                </div>
              </article>
            ) : null}

            <article className="studio-card">
              <div className="cr-manage-option-head">
                <StatusBadge status={rowLifecycleStatus(selected)} />
                <span className="muted">
                  Selection: {selected.selection_mode}
                  {selected.selection_mode === "automatic" ? " (rules)" : ""}
                </span>
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
                  <span>Public title</span>
                  <input
                    value={selected.public_title ?? ""}
                    onChange={(event) => patch(selected.id, { public_title: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={selected.public_description ?? ""}
                    onChange={(event) =>
                      patch(selected.id, { public_description: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Selection mode</span>
                  <select
                    value={selected.selection_mode}
                    onChange={(event) =>
                      patch(selected.id, {
                        selection_mode: event.target.value as Draft["selection_mode"],
                      })
                    }
                  >
                    <option value="automatic">Automatic</option>
                    <option value="manual">Manual</option>
                    {mode === "custom" ? <option value="filter">Filter-based</option> : null}
                  </select>
                </label>
                <label className="field">
                  <span>Max items</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={selected.max_items}
                    onChange={(event) =>
                      patch(selected.id, { max_items: Number(event.target.value) || 12 })
                    }
                  />
                </label>
                <label className="field">
                  <span>Display order</span>
                  <input
                    type="number"
                    min={1}
                    value={selected.sort_order}
                    onChange={(event) =>
                      patch(selected.id, { sort_order: Number(event.target.value) || 1 })
                    }
                  />
                </label>
              </div>

              {selected.selection_mode === "automatic" ? (
                <label className="field">
                  <span>Automatic rule</span>
                  <select
                    value={String(selected.selection_rules.rule ?? autoRules[0]?.value ?? "")}
                    onChange={(event) =>
                      patch(selected.id, {
                        selection_rules: { ...selected.selection_rules, rule: event.target.value },
                      })
                    }
                  >
                    {autoRules.map((rule) => (
                      <option key={rule.value} value={rule.value}>
                        {rule.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selected.selection_mode === "filter" ? (
                <div className="form-grid">
                  <label className="field">
                    <span>Interest filter</span>
                    <select
                      value={String(
                        Array.isArray(selected.selection_rules.interestIds)
                          ? selected.selection_rules.interestIds[0] ?? ""
                          : "",
                      )}
                      onChange={(event) =>
                        patch(selected.id, {
                          selection_rules: {
                            ...selected.selection_rules,
                            interestIds: event.target.value ? [event.target.value] : [],
                          },
                        })
                      }
                    >
                      <option value="">Any interest</option>
                      {interests.map((interest) => (
                        <option key={interest.id} value={interest.id}>
                          {interest.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Min adventure level</span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={Number(selected.selection_rules.minAdventureRank ?? 0)}
                      onChange={(event) =>
                        patch(selected.id, {
                          selection_rules: {
                            ...selected.selection_rules,
                            minAdventureRank: Number(event.target.value) || 0,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              ) : null}

              {selected.selection_mode === "manual" ? (
                <>
                  <ContentPicker
                    items={catalog}
                    selectedIds={selected.items.map((item) => item.item_id)}
                    onToggle={toggleItem}
                    placeholder={`Search ${itemKind} listings…`}
                  />
                  <ReorderList
                    items={orderedSelectedItems.map((item) => {
                      const card = catalog.find((entry) => entry.id === item.item_id);
                      return {
                        id: item.item_id,
                        label: card?.title ?? item.item_id,
                      };
                    })}
                    onReorder={(next) => {
                      patch(selected.id, {
                        items: next.map((entry, index) => {
                          const current = selected.items.find((item) => item.item_id === entry.id)!;
                          return { ...current, sort_order: index + 1 };
                        }),
                      });
                    }}
                  />
                </>
              ) : null}

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

              <div className="form-grid">
                <label className="field">
                  <span>View all destination</span>
                  <select
                    value={selected.view_all_kind ?? "none"}
                    onChange={(event) => patch(selected.id, { view_all_kind: event.target.value })}
                  >
                    <option value="none">None</option>
                    <option value="external">External URL</option>
                  </select>
                </label>
                {selected.view_all_kind === "external" ? (
                  <label className="field">
                    <span>View all URL</span>
                    <input
                      value={selected.view_all_url ?? ""}
                      onChange={(event) =>
                        patch(selected.id, { view_all_url: event.target.value })
                      }
                    />
                  </label>
                ) : null}
              </div>

              <DraftPublishBar
                status={rowLifecycleStatus(selected)}
                dirty={Boolean(selected.dirty)}
                busy={busy}
                onSaveDraft={() => void persist(selected, "draft")}
                onPublish={() => void persist(selected, "published")}
              />

              {mode === "custom" ? (
                <div className="cr-manage-publish-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy || selected.id.startsWith("tmp-")}
                    onClick={() => void duplicate(selected)}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => void archive(selected)}
                  >
                    Archive
                  </button>
                </div>
              ) : null}
            </article>
          </div>

          <aside className="cr-manage-aside">
            <PhonePreview label={`${selected.public_title || title} preview`}>
              <div className="cr-manage-chip-preview">
                <p className="eyebrow">{selected.public_title || title}</p>
                {selected.public_description ? (
                  <p className="muted">{selected.public_description}</p>
                ) : null}
                <div className="cr-manage-row-preview">
                  {preview.length === 0 ? (
                    <p className="muted">Empty row — hidden on the public feed when empty behaviour is hide.</p>
                  ) : (
                    preview.slice(0, selected.max_items).map((item) => (
                      <article key={item.id}>
                        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span />}
                        <strong>{item.title}</strong>
                        {item.subtitle ? <em>{item.subtitle}</em> : null}
                      </article>
                    ))
                  )}
                </div>
              </div>
            </PhonePreview>
          </aside>
        </div>
      )}
    </section>
  );
}
