/** Actions that mean a signed-in person opened the site or app and used it. */
export const USAGE_KINDS = ["scroll", "view_listing", "view_event", "view_community"] as const;

export type UsageKind = (typeof USAGE_KINDS)[number];

export function isUsageKind(value: string | undefined | null): value is UsageKind {
  return value === "scroll" || value === "view_listing" || value === "view_event" || value === "view_community";
}
