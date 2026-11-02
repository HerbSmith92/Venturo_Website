const MAX_BYTES = 12 * 1024 * 1024;

function allowedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "supabase.co" ||
    host.endsWith(".supabase.co") ||
    host === "supabase.in" ||
    host.endsWith(".supabase.in") ||
    host === "venturo.co.za" ||
    host.endsWith(".venturo.co.za") ||
    host.endsWith(".googleusercontent.com") ||
    host.endsWith(".ggpht.com") ||
    host === "maps.googleapis.com" ||
    host.endsWith(".vercel.app")
  );
}

export function isAllowedExportImageUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  return allowedHost(parsed.hostname);
}

export function exportPhotoSrc(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:") || trimmed.startsWith("/")) {
    return trimmed;
  }
  if (!isAllowedExportImageUrl(trimmed)) return trimmed;
  return `/api/admin/export-image?url=${encodeURIComponent(trimmed)}`;
}

export const EXPORT_IMAGE_MAX_BYTES = MAX_BYTES;
