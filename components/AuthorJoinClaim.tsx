"use client";

import { useEffect, useRef } from "react";
import { claimGuideAuthorInvite } from "@/app/admin/author-actions";

export function AuthorJoinClaim({ token }: { token: string }) {
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    form.current?.requestSubmit();
  }, []);

  return (
    <form ref={form} action={claimGuideAuthorInvite}>
      <input type="hidden" name="token" value={token} />
      <p className="muted">Taking you to your Author card…</p>
      <button className="btn btn-primary" type="submit">
        Continue to your profile
      </button>
    </form>
  );
}
