export const APP_ROLES = ["admin", "editor", "business", "member"] as const;

export type AppRole = (typeof APP_ROLES)[number];

function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "editor" || value === "business" || value === "member";
}

export function roleFromClaims(claims: Record<string, unknown> | null | undefined): AppRole | null {
  if (!claims) return null;

  const appMetadata = claims.app_metadata;
  if (appMetadata && typeof appMetadata === "object") {
    const role = (appMetadata as { role?: unknown }).role;
    if (isAppRole(role)) return role;
  }

  return null;
}

export function isAdmin(role: AppRole | null | undefined) {
  return role === "admin";
}

export function isStaff(role: AppRole | null | undefined) {
  return role === "admin" || role === "editor";
}
