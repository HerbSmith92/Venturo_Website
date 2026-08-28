"use client";

import { useEffect } from "react";

function isResetPath(pathname: string) {
  return (
    pathname.startsWith("/admin/reset-password") ||
    pathname.startsWith("/auth/callback")
  );
}

export function AuthCatcher() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (isResetPath(pathname)) return;

    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const query = new URLSearchParams(search);
    const type = hashParams.get("type") ?? query.get("type");
    const hasHashSession = Boolean(hashParams.get("access_token"));
    const code = query.get("code");
    const tokenHash = query.get("token_hash");

    const isRecovery =
      type === "recovery" ||
      hasHashSession ||
      Boolean(tokenHash && type === "recovery");

    if (code && !isResetPath(pathname)) {
      window.location.replace(`/auth/callback?next=/admin/reset-password&code=${encodeURIComponent(code)}`);
      return;
    }

    if (isRecovery) {
      window.location.replace(`/admin/reset-password${search}${hash}`);
    }
  }, []);

  return null;
}
