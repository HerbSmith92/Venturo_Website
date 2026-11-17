"use client";

import { useDeferredValue, useMemo, useState } from "react";

export type ContentPick = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  meta?: string | null;
};

export function ContentPicker({
  items,
  selectedIds,
  onToggle,
  placeholder = "Search listings…",
  emptyLabel = "No matches.",
}: {
  items: ContentPick[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = useMemo(() => {
    if (!deferred) return items;
    return items.filter((item) => {
      const hay = `${item.title} ${item.subtitle ?? ""} ${item.meta ?? ""}`.toLowerCase();
      return hay.includes(deferred);
    });
  }, [deferred, items]);

  return (
    <div className="cr-manage-picker">
      <label className="field">
        <span className="sr-only">Search</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
        />
      </label>
      {filtered.length === 0 ? (
        <p className="ops-empty">{emptyLabel}</p>
      ) : (
        <ul className="cr-manage-picker-list">
          {filtered.map((item) => {
            const on = selected.has(item.id);
            return (
              <li key={item.id}>
                <label className={on ? "is-on" : undefined}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(item.id)}
                  />
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" width={40} height={40} />
                  ) : (
                    <span className="cr-manage-picker-fallback" aria-hidden />
                  )}
                  <span>
                    <strong>{item.title}</strong>
                    {item.subtitle ? <span className="muted">{item.subtitle}</span> : null}
                    {item.meta ? <span className="muted">{item.meta}</span> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
