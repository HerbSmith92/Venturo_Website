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
      type === "recovery" || Boolean(tokenHash && type === "recovery");

    // Password-recovery links only — do not hijack member magic-link / OTP logins.
    if (isRecovery || (hasHashSession && type === "recovery")) {
      window.location.replace(`/admin/reset-password${search}${hash}`);
      return;
    }

    // Member email login / signup magic link (PKCE code on any public page).
    if (code && !pathname.startsWith("/admin")) {
      const next = query.get("next");
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/directory";
      window.location.replace(
        `/auth/callback?next=${encodeURIComponent(safeNext)}&code=${encodeURIComponent(code)}`,
      );
    }
  }, []);

  return null;
}
