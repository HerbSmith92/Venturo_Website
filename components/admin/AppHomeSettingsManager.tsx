"use client";

import { useState } from "react";
import { ReorderList, UnsavedGuard } from "@/components/admin/manage";
import {
  DEFAULT_APP_HOME_SETTINGS,
  parseAppHomeSettings,
  type AppHomeAdmin,
  type AppHomeScreen,
  type AppHomeScreenSettings,
} from "@/lib/app-home-types";

const SCREEN_LABEL: Record<AppHomeScreen, string> = {
  discover: "Discover",
  events: "Events",
  community: "Community",
};

const SECTION_LABELS: Record<string, string> = {
  banners: "Banners",
  hot: "Hot on Venturo",
  featured: "Featured",
  custom: "Custom rows",
};

export function AppHomeSettingsManager({
  screen,
  initial,
}: {
  screen: AppHomeScreen;
  initial: AppHomeAdmin;
}) {
  const [settings, setSettings] = useState<AppHomeScreenSettings>(
    parseAppHomeSettings(initial.settings),
  );
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(parseAppHomeSettings(initial.settings)),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = JSON.stringify(settings) !== baseline;

  async function save() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/app-home/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screen, settings }),
    });
    const body = (await response.json()) as { error?: string; settings?: AppHomeScreenSettings };
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Could not save settings.");
      return;
    }
    const next = body.settings ?? settings;
    setSettings(next);
    setBaseline(JSON.stringify(next));
    setMessage("Screen settings saved.");
  }

  function toggleHidden(section: string) {
    setSettings((current) => {
      const hidden = new Set(current.hiddenSections);
      if (hidden.has(section)) hidden.delete(section);
      else hidden.add(section);
      return { ...current, hiddenSections: [...hidden] };
    });
  }

  return (
    <section className="cr-manage">
      <UnsavedGuard dirty={dirty} />
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">Application View · {SCREEN_LABEL[screen]}</p>
          <h1>Settings</h1>
          <p className="lede muted">
            Presentation controls for this app tab — section order, visibility, default limits &amp;
            empty-row behaviour.
          </p>
        </div>
      </header>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}

      <article className="studio-card">
        <p className="eyebrow">Order</p>
        <h2>Section order</h2>
        <ReorderList
          items={settings.sectionOrder.map((id) => ({
            id,
            label: SECTION_LABELS[id] ?? id,
          }))}
          onReorder={(next) =>
            setSettings((current) => ({
              ...current,
              sectionOrder: next.map((item) => item.id),
            }))
          }
        />
      </article>

      <article className="studio-card">
        <p className="eyebrow">Visibility</p>
        <h2>Hide sections</h2>
        <div className="cr-manage-row-tabs">
          {Object.keys(SECTION_LABELS).map((section) => {
            const hidden = settings.hiddenSections.includes(section);
            return (
              <button
                key={section}
                type="button"
                className={hidden ? "btn" : "btn is-on"}
                onClick={() => toggleHidden(section)}
              >
                {hidden ? `Show ${SECTION_LABELS[section]}` : `Hide ${SECTION_LABELS[section]}`}
              </button>
            );
          })}
        </div>
      </article>

      <article className="studio-card">
        <p className="eyebrow">Defaults</p>
        <h2>Limits &amp; empty rows</h2>
        <div className="form-grid">
          <label className="field">
            <span>Default row limit</span>
            <input
              type="number"
              min={1}
              max={24}
              value={settings.defaultRowLimit}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  defaultRowLimit: Number(event.target.value) || DEFAULT_APP_HOME_SETTINGS.defaultRowLimit,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Empty-content behaviour</span>
            <select
              value={settings.emptyBehaviour}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  emptyBehaviour: event.target.value === "placeholder" ? "placeholder" : "hide",
                }))
              }
            >
              <option value="hide">Hide empty rows</option>
              <option value="placeholder">Show placeholder copy</option>
            </select>
          </label>
        </div>
        <button className="btn btn-primary" type="button" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </article>
    </section>
  );
}
