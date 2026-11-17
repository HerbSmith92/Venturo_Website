"use client";

import { useRef, type ReactNode } from "react";

export type ReorderItem = {
  id: string;
  label: string;
};

export function ReorderList<T extends ReorderItem>({
  items,
  onReorder,
  renderMeta,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderMeta?: (item: T) => ReactNode;
}) {
  const dragId = useRef<string | null>(null);

  function move(fromId: string, toId: string) {
    if (fromId === toId) return;
    const from = items.findIndex((item) => item.id === fromId);
    const to = items.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onReorder(next);
  }

  if (items.length === 0) {
    return <p className="ops-empty">Nothing to order yet.</p>;
  }

  return (
    <ul className="cr-manage-reorder">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="cr-manage-reorder-item"
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragId.current) move(dragId.current, item.id);
            dragId.current = null;
          }}
        >
          <button
            type="button"
            className="cr-guide-drag"
            draggable
            aria-label={`Drag to reorder ${item.label}`}
            onDragStart={() => {
              dragId.current = item.id;
            }}
            onDragEnd={() => {
              dragId.current = null;
            }}
          >
            ⋮⋮
          </button>
          <div className="cr-manage-reorder-copy">
            <strong>{item.label}</strong>
            {renderMeta ? <div className="muted">{renderMeta(item)}</div> : null}
          </div>
          <span className="cr-manage-reorder-index">{index + 1}</span>
        </li>
      ))}
    </ul>
  );
}
