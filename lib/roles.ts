export const APP_ROLES = ["admin", "editor", "business", "member"] as const;

export type AppRole = (typeof APP_ROLES)[number];

function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "editor" || value === "business" || value === "member";
}

export function roleFromAppMetadata(appMetadata: unknown): AppRole | null {
  if (!appMetadata || typeof appMetadata !== "object") return null;
  const role = (appMetadata as { role?: unknown }).role;
  return isAppRole(role) ? role : null;
}

export function roleFromClaims(claims: Record<string, unknown> | null | undefined): AppRole | null {
  if (!claims) return null;
  return roleFromAppMetadata(claims.app_metadata);
}

export function isAdmin(role: AppRole | null | undefined) {
  return role === "admin";
}

export function isStaff(role: AppRole | null | undefined) {
  return role === "admin" || role === "editor";
}
