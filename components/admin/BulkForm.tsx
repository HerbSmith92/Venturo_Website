"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

type BulkChoice = "" | "archive" | "delete";

export function BulkForm({
  formId,
  noun,
  nouns,
  action,
  returnTo,
  children,
}: {
  formId: string;
  noun: string;
  nouns: string;
  action: (formData: FormData) => Promise<void>;
  returnTo: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState<BulkChoice>("");
  const [count, setCount] = useState(0);
  const [all, setAll] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function boxes() {
    const form = formRef.current;
    if (!form) return [];
    return [...form.elements].filter(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement && element.name === "id" && element.type === "checkbox",
    );
  }

  function syncAll() {
    const items = boxes();
    setAll(items.length > 0 && items.every((item) => item.checked));
  }

  function toggleAll(checked: boolean) {
    boxes().forEach((item) => {
      item.checked = checked;
    });
    setAll(checked);
    setNote(null);
  }

  function ask(event: FormEvent) {
    event.preventDefault();
    const selected = new FormData(formRef.current ?? undefined).getAll("id").length;
    if (!choice) {
      setNote("Choose a bulk action.");
      return;
    }
    if (selected === 0) {
      setNote("Select at least one.");
      return;
    }
    setNote(null);
    flushSync(() => setCount(selected));
    dialogRef.current?.showModal();
  }

  async function confirm() {
    const form = formRef.current;
    if (!form || !choice) return;
    const data = new FormData(form);
    data.set("bulk", choice);
    data.set("return_to", returnTo);
    setPending(true);
    try {
      await action(data);
    } finally {
      setPending(false);
      dialogRef.current?.close();
    }
  }

  const verb = choice === "delete" ? "Delete" : "Archive";
  const label = count === 1 ? noun : nouns;

  return (
    <div onChange={syncAll}>
      <form id={formId} ref={formRef} onSubmit={ask}>
        <div className="cr-bulk">
          <label className="cr-bulk-all">
            <input
              type="checkbox"
              checked={all}
              aria-label={`Select all ${nouns}`}
              onChange={(event) => toggleAll(event.target.checked)}
            />
            <span>Select all</span>
          </label>
          <label className="cr-bulk-action">
            <span className="sr-only">Bulk action</span>
            <select
              value={choice}
              aria-label="Bulk action"
              onChange={(event) => {
                setChoice(event.target.value as BulkChoice);
                setNote(null);
              }}
            >
              <option value="">Bulk action</option>
              <option value="archive">Archive</option>
              <option value="delete">Delete</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit">
            Apply
          </button>
          {note ? <p className="muted">{note}</p> : null}
        </div>
        <dialog ref={dialogRef} className="cr-bulk-dialog">
          <p>{`Are you sure you want to ${verb} ${count} ${label}?`}</p>
          <div className="cr-bulk-dialog-actions">
            <button className="btn btn-secondary" type="button" onClick={() => dialogRef.current?.close()} disabled={pending}>
              Cancel
            </button>
            <button className="btn btn-primary" type="button" onClick={() => void confirm()} disabled={pending}>
              {pending ? "Working…" : verb}
            </button>
          </div>
        </dialog>
      </form>
      {children}
    </div>
  );
}
