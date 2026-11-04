"use client";

import { useEffect } from "react";
import type { GuideKind } from "@/lib/guide-engagement";

export function GuideViewBeacon({ kind, id }: { kind: GuideKind; id: string }) {
  useEffect(() => {
    if (!id) return;
    void fetch("/api/guides/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ kind, id }),
    });
  }, [kind, id]);
  return null;
}
