"use client";

import { useEffect } from "react";

export function InviteOpenBeacon({ token }: { token: string }) {
  useEffect(() => {
    const key = `venturo-invite-open:${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode can block storage; still mark this open.
    }
    void fetch(`/api/invite/${token}/open`, { method: "POST", keepalive: true });
  }, [token]);

  return null;
}
