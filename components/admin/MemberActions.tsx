"use client";

import { useState } from "react";
import { deleteMember, resetMemberAccess } from "@/app/admin/actions";

export function MemberActions({
  userId,
  email,
  canManage,
  isSelf,
}: {
  userId: string;
  email: string | null;
  canManage: boolean;
  isSelf: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<"reset" | "delete" | null>(null);

  if (!canManage) {
    return <span className="muted">View only</span>;
  }

  async function onReset() {
    if (!email) {
      setError("This user has no email.");
      return;
    }
    if (!confirm(`Send a password reset email to ${email}?`)) return;
    setPending("reset");
    setError(null);
    setNotice(null);
    const result = await resetMemberAccess(userId);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(result.message);
  }

  async function onDelete() {
    if (isSelf) {
      setError("You cannot delete your own admin account.");
      return;
    }
    const label = email ?? "this user";
    if (
      !confirm(
        `Delete ${label}? Their profile, tickets, & organiser data linked by cascade may be removed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setPending("delete");
    setError(null);
    setNotice(null);
    const result = await deleteMember(userId);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="cr-member-actions">
      <div className="cr-actions">
        <button
          className="btn btn-secondary"
          type="button"
          disabled={pending !== null || !email}
          onClick={() => void onReset()}
        >
          {pending === "reset" ? "Sending…" : "Reset Password"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={pending !== null || isSelf}
          onClick={() => void onDelete()}
        >
          {pending === "delete" ? "Deleting…" : "Delete"}
        </button>
      </div>
      {error && <p className="error" style={{ margin: "8px 0 0" }}>{error}</p>}
      {notice && <p className="notice" style={{ margin: "8px 0 0" }}>{notice}</p>}
    </div>
  );
}
