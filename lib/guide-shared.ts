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

export const UNDER_PRICE_TITLE = "Under R200 Adventures";
export const GUIDE_NEAR_KM = 25;
export const GUIDE_FILL_LIMIT = 24;

export type GuidePlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

const UNDER_PRICE_TITLE_RE = /^Under R(\d+) Adventures(?: in and around (.+))?$/;

export function underPriceTitle(amount: number, placeName: string | null) {
  const rounded = Math.round(amount);
  const base = `Under R${rounded} Adventures`;
  const place = placeName?.trim();
  return place ? `${base} in and around ${place}` : base;
}

export function parseUnderPriceTitle(title: string) {
  const match = title.trim().match(UNDER_PRICE_TITLE_RE);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, placeName: match[2]?.trim() || null };
}

export function pricedGuideSummary(
  shown: number,
  total: number,
  amount: number,
  placeName: string | null,
  audience: string | null = null,
) {
  const rounded = Math.round(amount);
  const where = placeName
    ? `under R${rounded} in and around ${placeName}`
    : `under R${rounded}`;
  const scoped = audience ? `${where} for ${audience}` : where;
  if (total === 0) return `No live listings ${scoped}.`;
  const noun = total === 1 ? "live listing" : "live listings";
  if (shown < total) {
    const order = placeName ? "nearest first" : "lowest price first";
    const near = placeName
      ? `under R${rounded} within ${GUIDE_NEAR_KM} km of ${placeName}`
      : `under R${rounded}`;
    const limited = audience ? `${near} for ${audience}` : near;
    return `Showing ${shown} of ${total} ${noun} ${limited}, ${order}.`;
  }
  return `${total} ${noun} ${scoped}.`;
}

export type GuideAudienceMatch = {
  kindIds?: string[];
  personaIds?: string[];
  scaleId?: string | null;
  interestIds?: string[];
};

/** A listing must fit every audience group that is turned on. Inside a group, any tag is enough. */
export function listingMatchesGuideAudience(
  listing: {
    kind_ids?: string[] | null;
    persona_ids?: string[] | null;
    scale_ids?: string[] | null;
    interest_ids?: string[] | null;
  },
  audience: GuideAudienceMatch,
) {
  const wanted = (ids: string[] | null | undefined) => (ids ?? []).filter(Boolean);
  const hasAny = (ids: string[], have: string[] | null | undefined) =>
    ids.some((id) => (have ?? []).includes(id));
  const kinds = wanted(audience.kindIds);
  const personas = wanted(audience.personaIds);
  const interests = wanted(audience.interestIds);
  const scale = audience.scaleId?.trim() ?? "";
  if (kinds.length && !hasAny(kinds, listing.kind_ids)) return false;
  if (personas.length && !hasAny(personas, listing.persona_ids)) return false;
  if (interests.length && !hasAny(interests, listing.interest_ids)) return false;
  if (scale && !(listing.scale_ids ?? []).includes(scale)) return false;
  return true;
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

export type GuideFromPriceSource = {
  standard_price: number | string | null;
  is_active?: boolean | null;
  show_on_from?: boolean | null;
  listing_activity_id?: string | null;
};

export type GuideFromActivity = {
  id: string;
  cost_varied?: boolean | null;
  status?: string | null;
};

/** Lowest standard price among rows ticked Include in From. Unticked prices do not count. */
export function guideFromPrice(
  prices: GuideFromPriceSource[] | null | undefined,
  activities: GuideFromActivity[] | null | undefined,
) {
  const skip = new Set(
    (activities ?? [])
      .filter((activity) => activity.cost_varied || activity.status === "archived")
      .map((activity) => activity.id),
  );
  const amounts: number[] = [];
  for (const price of prices ?? []) {
    if (price.is_active === false || price.show_on_from !== true) continue;
    if (price.listing_activity_id && skip.has(price.listing_activity_id)) continue;
    if (price.standard_price == null || price.standard_price === "") continue;
    const amount =
      typeof price.standard_price === "number" ? price.standard_price : Number(price.standard_price);
    if (!Number.isFinite(amount) || amount < 0) continue;
    amounts.push(amount);
  }
  if (!amounts.length) return null;
  return Math.min(...amounts);
}

export function pickPricedGuideListings<
  T extends {
    name: string;
    price_from: number | string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  },
>(
  rows: T[],
  input: {
    maxPrice: number;
    lat?: number | null;
    lng?: number | null;
    radiusKm?: number;
    limit?: number;
  },
) {
  const maxPrice = input.maxPrice;
  const limit = input.limit ?? GUIDE_FILL_LIMIT;
  const hasPlace = input.lat != null && input.lng != null;
  const radius = input.radiusKm ?? GUIDE_NEAR_KM;
  const priced = rows.flatMap((row) => {
    if (row.price_from == null || row.price_from === "") return [];
    const price = typeof row.price_from === "number" ? row.price_from : Number(row.price_from);
    if (!Number.isFinite(price) || price < 0 || price > maxPrice) return [];
    const lat = row.latitude == null || row.latitude === "" ? null : Number(row.latitude);
    const lng = row.longitude == null || row.longitude === "" ? null : Number(row.longitude);
    const km =
      hasPlace && lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
        ? distanceKm(input.lat as number, input.lng as number, lat, lng)
        : null;
    if (hasPlace && (km == null || km > radius)) return [];
    return [{ row, price, km: km ?? Number.POSITIVE_INFINITY }];
  });
  priced.sort((a, b) => {
    if (hasPlace && a.km !== b.km) return a.km - b.km;
    if (a.price !== b.price) return a.price - b.price;
    return a.row.name.localeCompare(b.row.name);
  });
  return {
    total: priced.length,
    matches: priced.slice(0, limit).map((item) => item.row),
  };
}

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
  street_address_1: string | null;
  street_address_2: string | null;
  postal_code: string | null;
  short_description: string | null;
  price_from: number | string | null;
  status: string;
  image: string | null;
  indoor_outdoor: "indoor" | "outdoor" | "both" | null;
  booking_required: boolean;
  activity_kind_key: string | null;
  activity_kind_title: string | null;
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
  kind_ids: string[];
  persona_ids: string[];
  scale_id: string;
  interest_ids: string[];
  items: GuideDraftItem[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseGuideIds(value: string | null, limit = 12): string[] {
  if (!value) return [];
  const ids: string[] = [];
  for (const part of value.split(",")) {
    const id = part.trim();
    if (UUID_RE.test(id) && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, limit);
}

export function parseGuideInterestIds(value: string | null): string[] {
  return parseGuideIds(value, 12);
}
