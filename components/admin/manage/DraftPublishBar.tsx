"use client";

import { StatusBadge } from "@/components/admin/manage/StatusBadge";
import type { ScheduleStatus } from "@/lib/control-room-schedule";

export function DraftPublishBar({
  status,
  dirty,
  busy,
  message,
  onSaveDraft,
  onPublish,
  publishLabel = "Publish",
  draftLabel = "Save draft",
}: {
  status: ScheduleStatus;
  dirty: boolean;
  busy?: boolean;
  message?: string | null;
  onSaveDraft: () => void;
  onPublish?: () => void;
  publishLabel?: string;
  draftLabel?: string;
}) {
  return (
    <div className="cr-manage-publish-bar">
      <div className="cr-manage-publish-meta">
        <StatusBadge status={status} />
        {dirty ? <span className="muted">Unsaved changes</span> : null}
        {message ? (
          <p className="notice" role="status">
            {message}
          </p>
        ) : null}
      </div>
      <div className="cr-manage-publish-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || !dirty}
          onClick={onSaveDraft}
        >
          {busy ? "Saving…" : draftLabel}
        </button>
        {onPublish ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={onPublish}
          >
            {publishLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
