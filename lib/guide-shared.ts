export const GUIDE_STATUSES = ["draft", "published", "archived"] as const;
export type GuideStatus = (typeof GUIDE_STATUSES)[number];

export const GUIDE_ACTIONS = ["publish", "unpublish", "archive"] as const;
export type GuideAction = (typeof GUIDE_ACTIONS)[number];

export const SUGGESTED_GUIDE_TITLES = [
  "Top Things to Do This Weekend",
  "5 Things to Do With the Kids This Weekend",
  "Your Weekend Adventure List",
  "Things to Do When It’s Raining",
  "Date Ideas That Aren’t Dinner",
  "Get Outdoors This Weekend",
  "Something Different to Try",
  "Under R200 Adventures",
  "Things to Do With Your Dog",
  "School Holiday Adventures",
] as const;

export function isGuideStatus(value: string): value is GuideStatus {
  return GUIDE_STATUSES.includes(value as GuideStatus);
}

export function isGuideAction(value: string): value is GuideAction {
  return GUIDE_ACTIONS.includes(value as GuideAction);
}

export function guideStatusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

const ZA = "Africa/Johannesburg";

export function toZaLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function fromZaLocalInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}:00+02:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function formatGuideWindow(publishAt: string | null, expireAt: string | null) {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-ZA", {
      timeZone: ZA,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));

  if (!publishAt && !expireAt) return "Evergreen";
  if (publishAt && expireAt) return `${fmt(publishAt)} – ${fmt(expireAt)}`;
  if (publishAt) return `From ${fmt(publishAt)}`;
  return `Until ${fmt(expireAt!)}`;
}

export type GuideListingPreview = {
  id: string;
  name: string;
  slug: string;
  suburb: string | null;
  city: string | null;
  short_description: string | null;
  price_from: number | string | null;
  status: string;
  image: string | null;
};

export type GuideDraftItem = {
  listing_id: string;
  editorial_note: string;
  listing: GuideListingPreview | null;
};

export type GuideDraft = {
  title: string;
  intro: string;
  publish_at: string;
  expire_at: string;
  interest_ids: string[];
  items: GuideDraftItem[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseGuideInterestIds(value: string | null): string[] {
  if (!value) return [];
  const ids: string[] = [];
  for (const part of value.split(",")) {
    const id = part.trim();
    if (UUID_RE.test(id) && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, 12);
}
