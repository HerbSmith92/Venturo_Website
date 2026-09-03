/** Same-origin absolute path only. Rejects protocol-relative URLs. */
export function safeNextPath(raw: unknown, fallback = "/onboarding") {
  if (typeof raw !== "string") return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}
