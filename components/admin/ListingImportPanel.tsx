"use client";

import { useRef, useState, useTransition, type DragEvent, type FormEvent } from "react";
import {
  commitDirectoryImport,
  previewDirectoryImport,
  type DirectoryImportPreview,
} from "@/app/admin/listing-import-actions";
import type { DirectoryPreviewOutcome } from "@/lib/directory-csv";

const RESULT_LABEL: Record<DirectoryPreviewOutcome, string> = {
  new: "New",
  existing: "Already on the directory",
  duplicate: "Repeated in this file",
  nameless: "Needs a name",
};

export function ListingImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftsReady, setDraftsReady] = useState(false);
  const [fileName, setFileName] = useState("");
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<Extract<DirectoryImportPreview, { ok: true }> | null>(null);

  function clearPreview() {
    setPreview(null);
    setError("");
    setNotice("");
    setDraftsReady(false);
  }

  function takeFile(file: File | undefined) {
    const input = fileRef.current;
    if (!input || !file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    setFileName(file.name);
    clearPreview();
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    takeFile(event.dataTransfer.files?.[0]);
  }

  function onPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    clearPreview();
    startTransition(async () => {
      const result = await previewDirectoryImport(data);
      if (!result.ok) {
        setPreview(null);
        setError(result.error);
        return;
      }
      setPreview(result);
    });
  }

  function onCommit() {
    if (!preview || preview.newRows.length === 0) return;
    setError("");
    setNotice("");
    setDraftsReady(false);
    const rows = preview.newRows;
    startTransition(async () => {
      const result = await commitDirectoryImport(rows);
      const created =
        result.created === 1 ? "1 draft was created." : `${result.created} drafts were created.`;
      setPreview(null);
      if (!result.ok) {
        setDraftsReady(result.created > 0);
        setError(result.created > 0 ? `${created} ${result.error}` : result.error);
        return;
      }
      if (result.created === 0) {
        setDraftsReady(false);
        setNotice("Nothing new to import. Those rows are already on the directory or repeated in the file.");
        return;
      }
      setDraftsReady(true);
      setNotice(created);
    });
  }

  const counts = preview ? countOutcomes(preview.lines) : null;

  return (
    <div className="cr-import-panel">
      <div className="cr-import-grid">
        <article className="cr-import-card">
          <h2>Take a Copy</h2>
          <p>Grab a blank template, or take the whole directory with you.</p>
          <div className="cr-actions">
            <a className="btn btn-secondary" href="/admin/listings/import/template">
              Download template
            </a>
            <a className="btn btn-secondary" href="/admin/listings/import/export">
              Export directory
            </a>
          </div>
        </article>

        <article className="cr-import-card">
          <h2>Bring Them In</h2>
          <p>Drop a CSV. We check it before a single row is saved.</p>
          <form className="cr-import-upload" onSubmit={onPreview}>
            <label
              className={over ? "cr-import-drop is-over" : "cr-import-drop"}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileRef}
                className="sr-only"
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                onChange={(event) => {
                  setFileName(event.target.files?.[0]?.name ?? "");
                  clearPreview();
                }}
              />
              <strong>{fileName || "Choose a CSV"}</strong>
              <span>{fileName ? "Ready to check" : "or drop it here"}</span>
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending && !preview ? "Checking…" : "Check the file"}
            </button>
          </form>
        </article>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="cr-import-notice">{notice}</p> : null}
      {draftsReady ? (
        <p className="cr-import-notice">
          <a href="/admin/listings?status=draft">Open drafts</a>
        </p>
      ) : null}

      {preview && counts ? (
        <div className="cr-import-review">
          <ul className="cr-import-counts">
            <li>
              <strong>{counts.new}</strong>
              <span>New</span>
            </li>
            <li>
              <strong>{counts.existing}</strong>
              <span>Already on the directory</span>
            </li>
            <li>
              <strong>{counts.duplicate}</strong>
              <span>Repeated in this file</span>
            </li>
            <li>
              <strong>{counts.nameless}</strong>
              <span>{counts.nameless === 1 ? "Needs a name" : "Need a name"}</span>
            </li>
          </ul>
          <div className="cr-table-wrap cr-import-preview">
            <table className="cr-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Name</th>
                  <th>Place</th>
                  <th>Result</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line) => (
                  <tr key={`${line.line}-${line.outcome}`}>
                    <td>{line.line}</td>
                    <td>{line.name}</td>
                    <td>{line.place}</td>
                    <td className={`cr-import-result is-${line.outcome}`}>{RESULT_LABEL[line.outcome]}</td>
                    <td>{line.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cr-actions">
            <button className="btn btn-primary" type="button" disabled={pending || counts.new === 0} onClick={onCommit}>
              {pending ? "Importing…" : counts.new === 1 ? "Import 1 draft" : `Import ${counts.new} drafts`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function countOutcomes(lines: { outcome: DirectoryPreviewOutcome }[]) {
  return {
    new: lines.filter((line) => line.outcome === "new").length,
    existing: lines.filter((line) => line.outcome === "existing").length,
    duplicate: lines.filter((line) => line.outcome === "duplicate").length,
    nameless: lines.filter((line) => line.outcome === "nameless").length,
  };
}
