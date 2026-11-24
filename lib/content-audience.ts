/** Content audience restriction (not event persona / audience_gender). Client-safe. */

export type ContentAudience = "all" | "women" | "men";

export const AUDIENCE_OPTIONS: { value: ContentAudience; label: string; badge: string | null }[] = [
  { value: "all", label: "All", badge: null },
  { value: "women", label: "Women only", badge: "Women only" },
  { value: "men", label: "Men only", badge: "Men only" },
];

export function parseContentAudience(value: string | null | undefined): ContentAudience {
  if (value === "women" || value === "men") return value;
  return "all";
}

export function audienceBadge(audience: ContentAudience): string | null {
  if (audience === "women") return "Women only";
  if (audience === "men") return "Men only";
  return null;
}

export function audienceAllowedForCommunity(
  communityAudience: ContentAudience,
  eventAudience: ContentAudience,
): boolean {
  if (communityAudience === "all") return true;
  return eventAudience === communityAudience;
}

export function requiredEventAudienceForCommunity(
  communityAudience: ContentAudience,
  currentEventAudience: ContentAudience,
): ContentAudience {
  if (communityAudience === "all") return currentEventAudience;
  return communityAudience;
}
