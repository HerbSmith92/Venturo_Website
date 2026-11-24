"use client";

import {
  ADVENTURE_LEVELS,
  SETTING_OPTIONS,
  type IndoorOutdoorSetting,
} from "@/components/search/types";

export type PendingFilters = {
  settings: IndoorOutdoorSetting[];
  levelMin: number | null;
  levelMax: number | null;
};

export function SearchFiltersDrawer({
  open,
  pending,
  onChange,
  onClose,
  onApply,
  onClear,
  resultCount,
}: {
  open: boolean;
  pending: PendingFilters;
  onChange: (next: PendingFilters) => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  resultCount: number | null;
}) {
  if (!open) return null;

  function toggleSetting(value: IndoorOutdoorSetting) {
    const has = pending.settings.includes(value);
    onChange({
      ...pending,
      settings: has
        ? pending.settings.filter((item) => item !== value)
        : [...pending.settings, value],
    });
  }

  function setExactLevel(rank: number) {
    onChange({ ...pending, levelMin: rank, levelMax: rank });
  }

  function setAnyLevel() {
    onChange({ ...pending, levelMin: null, levelMax: null });
  }

  const anyLevel = pending.levelMin == null && pending.levelMax == null;

  return (
    <div className="search-filters-root" role="dialog" aria-modal="true" aria-label="Filters">
      <button type="button" className="search-filters-scrim" aria-label="Close filters" onClick={onClose} />
      <aside className="search-filters-panel">
        <header className="search-filters-head">
          <h2>Filters</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <section className="search-filters-section">
          <h3>Setting</h3>
          <p className="search-filters-hint">
            Indoor &amp; Outdoor means the listing includes both environments. Multiple selections match any selected setting.
          </p>
          <div className="search-chip-row">
            {SETTING_OPTIONS.map((option) => {
              const on = pending.settings.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`chip${on ? " active" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleSetting(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="search-filters-section">
          <h3>Adventure level</h3>
          <p className="search-filters-hint">Any level includes unassigned adventures. A range excludes them.</p>
          <div className="search-chip-row">
            <button
              type="button"
              className={`chip${anyLevel ? " active" : ""}`}
              aria-pressed={anyLevel}
              onClick={setAnyLevel}
            >
              Any level
            </button>
            {ADVENTURE_LEVELS.map((level) => {
              const on =
                pending.levelMin === level.rank && pending.levelMax === level.rank;
              return (
                <button
                  key={level.rank}
                  type="button"
                  className={`chip${on ? " active" : ""}`}
                  aria-pressed={on}
                  onClick={() => setExactLevel(level.rank)}
                >
                  {level.rank}. {level.title}
                </button>
              );
            })}
          </div>
          <div className="search-level-range">
            <label>
              Min
              <select
                value={pending.levelMin ?? ""}
                onChange={(event) => {
                  const value = event.target.value ? Number(event.target.value) : null;
                  const max = pending.levelMax;
                  onChange({
                    ...pending,
                    levelMin: value,
                    levelMax: value != null && max != null && max < value ? value : max,
                  });
                }}
              >
                <option value="">Any</option>
                {ADVENTURE_LEVELS.map((level) => (
                  <option key={level.rank} value={level.rank}>
                    {level.rank}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Max
              <select
                value={pending.levelMax ?? ""}
                onChange={(event) => {
                  const value = event.target.value ? Number(event.target.value) : null;
                  const min = pending.levelMin;
                  onChange({
                    ...pending,
                    levelMax: value,
                    levelMin: value != null && min != null && min > value ? value : min,
                  });
                }}
              >
                <option value="">Any</option>
                {ADVENTURE_LEVELS.map((level) => (
                  <option key={level.rank} value={level.rank}>
                    {level.rank}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <footer className="search-filters-foot">
          <button type="button" className="btn btn-ghost" onClick={onClear}>
            Clear filters
          </button>
          <button type="button" className="btn btn-primary" onClick={onApply}>
            {resultCount == null ? "Show results" : `Show ${resultCount} result${resultCount === 1 ? "" : "s"}`}
          </button>
        </footer>
      </aside>
    </div>
  );
}
