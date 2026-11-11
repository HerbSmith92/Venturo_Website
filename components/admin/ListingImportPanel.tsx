"use client";

import { useState, useTransition, type FormEvent } from "react";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftsReady, setDraftsReady] = useState(false);
  const [preview, setPreview] = useState<Extract<DirectoryImportPreview, { ok: true }> | null>(null);

  function onPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setNotice("");
    setDraftsReady(false);
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
    <div className="import-panel">
      <form className="import-upload" onSubmit={onPreview}>
        <label className="field">
          <span>CSV file</span>
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={() => {
              setPreview(null);
              setError("");
              setNotice("");
              setDraftsReady(false);
            }}
          />
        </label>
        <button className="btn btn-secondary" type="submit" disabled={pending}>
          {pending && !preview ? "Checking…" : "Check the file"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="import-notice">{notice}</p> : null}
      {draftsReady ? (
        <p className="import-notice">
          <a href="/admin/listings?status=draft">Open drafts</a>
        </p>
      ) : null}

      {preview && counts ? (
        <div className="import-review">
          <p className="import-summary">
            <span>
              <strong>{counts.new}</strong> new
            </span>
            <span>
              <strong>{counts.existing}</strong> already on the directory
            </span>
            <span>
              <strong>{counts.duplicate}</strong> repeated in this file
            </span>
            <span>
              <strong>{counts.nameless}</strong> {counts.nameless === 1 ? "needs a name" : "need a name"}
            </span>
          </p>
          <div className="cr-table-wrap import-preview">
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
                    <td>{RESULT_LABEL[line.outcome]}</td>
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
