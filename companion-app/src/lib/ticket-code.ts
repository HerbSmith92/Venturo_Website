/** Normalise QR payloads / pasted codes to the 12-char ticket code. */
export function normalizeTicketCode(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const fromQuery = url.searchParams.get("code") || url.searchParams.get("ticket");
      if (fromQuery) return fromQuery.trim().toUpperCase();
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return last.trim().toUpperCase();
    }
  } catch {
    // fall through
  }

  const venturoMatch = trimmed.match(/venturo:\/\/ticket\/([A-Za-z0-9]+)/i);
  if (venturoMatch?.[1]) return venturoMatch[1].toUpperCase();

  const jsonMatch = trimmed.match(/"code"\s*:\s*"([A-Za-z0-9]+)"/i);
  if (jsonMatch?.[1]) return jsonMatch[1].toUpperCase();

  return trimmed.replace(/\s+/g, "").toUpperCase();
}
