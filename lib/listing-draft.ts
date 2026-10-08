import type {
  ListingDetail,
  ListingMedia,
  ListingPriceOption,
  PriceAppliesTo,
  PriceCategory,
} from "@/lib/control-room-types";
import {
  formatDay,
  formatHours,
  formatRand,
  listingStatusLabel,
  type AuditEvent,
  type ListingStatus,
} from "@/lib/control-room-shared";

export type SocialPlatform = "instagram" | "facebook" | "tiktok";

export type DraftHour = {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
  vacation_opens_at: string;
  vacation_closes_at: string;
  vacation_is_closed: boolean;
};

export type DraftPrice = {
  id: string;
  clientKey: string;
  name: string;
  standard_price: string;
  member_price: string;
  inclusions: string;
  applies_to: PriceAppliesTo | "";
  price_category: PriceCategory;
  discount_rand: string;
  discount_percent: string;
  group_size: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  show_on_from: boolean;
  sort_order: number;
  couples_exclusive: boolean;
};

export type DraftActivity = {
  id: string;
  clientKey: string;
  name: string;
  short_description: string;
  description: string;
  duration_minutes: string;
  minimum_age: string;
  maximum_age: string;
  booking_required: boolean;
  sort_order: number;
  is_active: boolean;
  show_on_discover: boolean;
  show_on_from: boolean;
  cost_varied: boolean;
  prices: DraftPrice[];
};

export type DraftMedia = {
  id: string;
  public_url: string;
  alt_text: string;
  is_cover: boolean;
  sort_order: number;
  is_pending?: boolean;
  _delete?: boolean;
};

export type DraftSocial = {
  platform: SocialPlatform;
  handle: string;
  url: string;
};

export type ListingDraft = {
  name: string;
  branch_name: string;
  short_description: string;
  description: string;
  phone: string;
  email: string;
  website_url: string;
  booking_url: string;
  street_address_1: string;
  street_address_2: string;
  suburb: string;
  city: string;
  province: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  maps_url: string;
  booking_required: boolean;
  indoor_outdoor: "" | "indoor" | "outdoor" | "both";
  business_name: string;
  business_description: string;
  business_website: string;
  hours: DraftHour[];
  activities: DraftActivity[];
  media: DraftMedia[];
  social: DraftSocial[];
  persona_ids: string[];
  interest_ids: string[];
  interest_keywords: string;
  persona_keywords: string;
  scale_id: string;
  kind_ids: string[];
  cover_media_id: string;
  authorised_to_submit: boolean;
  image_rights_granted: boolean;
  terms_accepted: boolean;
};

export type EditorCatalog = {
  personas: { id: string; title: string }[];
  scales: { id: string; title: string; subtitle: string }[];
  kinds: { id: string; key: string; title: string }[];
  interests: { id: string; title: string; kind_key: string; kind_title: string }[];
};

export type EditorBranch = {
  id: string;
  name: string;
  branch_name: string | null;
  status: ListingStatus;
  suburb?: string | null;
  city?: string | null;
  price_from?: number | string | null;
  cover_url?: string | null;
};

export type StepKey =
  | "business"
  | "location"
  | "hours"
  | "contact"
  | "prices"
  | "photos"
  | "audience"
  | "review";

/** Editor labels for activity kinds, in the Who's it for order. */
export const INTEREST_CHIPS: { key: string; label: string }[] = [
  { key: "adventure", label: "Adventure" },
  { key: "thrills", label: "Thrills" },
  { key: "romance", label: "Romance" },
  { key: "family", label: "Family" },
  { key: "nightlife", label: "Nightlife" },
  { key: "team", label: "Social Sport" },
  { key: "workshop", label: "Workshops" },
  { key: "markets", label: "Markets" },
  { key: "digital", label: "Games" },
  { key: "third-party", label: "Shows" },
];

export function interestIdsFromKeywords(
  keywords: string,
  interests: { id: string; title: string }[],
) {
  const ids: string[] = [];
  for (const part of keywords.split(",")) {
    const name = part.trim().toLowerCase();
    if (!name) continue;
    const match = interests.find((item) => item.title.trim().toLowerCase() === name);
    if (match && !ids.includes(match.id)) ids.push(match.id);
  }
  return ids;
}

export function interestKeywordsFromIds(
  ids: string[],
  interests: { id: string; title: string }[],
) {
  return ids
    .map((id) => interests.find((item) => item.id === id)?.title)
    .filter((title): title is string => Boolean(title))
    .join(", ");
}

export const EDITOR_STEPS: { key: StepKey; label: string; number: number }[] = [
  { key: "business", label: "The Listing", number: 1 },
  { key: "location", label: "Location", number: 2 },
  { key: "hours", label: "Operating Hours", number: 3 },
  { key: "contact", label: "Contact & Socials", number: 4 },
  { key: "prices", label: "Activities & Costs", number: 5 },
  { key: "photos", label: "Photos", number: 6 },
  { key: "audience", label: "Who's it for?", number: 7 },
  { key: "review", label: "Permission & Review", number: 8 },
];

export const APPLIES_TO_OPTIONS: { value: PriceAppliesTo; label: string }[] = [
  { value: "person", label: "Per Person" },
  { value: "couple", label: "Per Couple" },
  { value: "adult", label: "Adult" },
  { value: "child", label: "Child" },
  { value: "pensioner", label: "Pensioner" },
  { value: "group", label: "Per Group" },
  { value: "hour", label: "Per hour" },
  { value: "item", label: "Per item" },
  { value: "custom", label: "Custom" },
];

export const SUB_APPLIES_OPTIONS: { value: PriceAppliesTo; label: string }[] = [
  { value: "person", label: "Per Person" },
  { value: "couple", label: "Per Couple" },
  { value: "group", label: "Per Group" },
];

export const PRICE_CATEGORY_OPTIONS: { value: PriceCategory; label: string }[] = [
  { value: "admission", label: "Admission" },
  { value: "activity", label: "Activity" },
  { value: "package", label: "Package" },
  { value: "rental", label: "Rental" },
  { value: "add_on", label: "Add-on" },
  { value: "other", label: "Other" },
];

function asText(value: string | null | undefined) {
  return value ?? "";
}

function asTime(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

function asMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

function asInt(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : "";
}

function asDate(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function oneBiz(listing: ListingDetail) {
  const biz = listing.businesses;
  if (!biz) return null;
  return Array.isArray(biz) ? biz[0] ?? null : biz;
}

function socialFor(platform: SocialPlatform, listing: ListingDetail): DraftSocial {
  const row = (listing.social_links ?? []).find((item) => item.platform === platform);
  return {
    platform,
    handle: asText(row?.handle),
    url: asText(row?.url),
  };
}

function clientKey(prefix: string, stableId?: string) {
  if (stableId) return `${prefix}-${stableId}`;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asAppliesTo(value: string | null | undefined): PriceAppliesTo {
  const allowed: PriceAppliesTo[] = [
    "person",
    "couple",
    "adult",
    "child",
    "pensioner",
    "group",
    "hour",
    "item",
    "custom",
  ];
  if (value && allowed.includes(value as PriceAppliesTo)) return value as PriceAppliesTo;
  return "person";
}

function asPriceCategory(value: string | null | undefined): PriceCategory {
  const allowed: PriceCategory[] = [
    "activity",
    "admission",
    "package",
    "rental",
    "add_on",
    "other",
  ];
  if (value && allowed.includes(value as PriceCategory)) return value as PriceCategory;
  return "admission";
}

export function emptyHours(): DraftHour[] {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((day) => ({
    day_of_week: day,
    opens_at: "",
    closes_at: "",
    is_closed: true,
    vacation_opens_at: "",
    vacation_closes_at: "",
    vacation_is_closed: false,
  }));
}

function formatMoneyInput(amount: number) {
  if (!Number.isFinite(amount)) return "";
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/** Member price from a rand discount or a percentage discount. Empty when neither is set. */
export function derivedMemberPrice(standard: string, rand: string, percent: string) {
  const base = Number(standard);
  if (!standard.trim() || !Number.isFinite(base)) return "";
  if (rand.trim()) {
    const off = Number(rand);
    if (!Number.isFinite(off)) return "";
    return formatMoneyInput(Math.max(0, base - off));
  }
  if (percent.trim()) {
    const rate = Number(percent);
    if (!Number.isFinite(rate)) return "";
    return formatMoneyInput(Math.max(0, base * (1 - rate / 100)));
  }
  return "";
}

export function emptyPrice(sortOrder = 0): DraftPrice {
  return {
    id: "",
    clientKey: clientKey("price"),
    name: "",
    standard_price: "",
    member_price: "",
    inclusions: "",
    applies_to: "",
    price_category: "admission",
    discount_rand: "",
    discount_percent: "",
    group_size: "",
    valid_from: "",
    valid_until: "",
    is_active: true,
    show_on_from: false,
    sort_order: sortOrder,
    couples_exclusive: false,
  };
}

export function emptyActivity(name = "General", sortOrder = 0): DraftActivity {
  return {
    id: "",
    clientKey: clientKey("activity"),
    name,
    short_description: "",
    description: "",
    duration_minutes: "",
    minimum_age: "",
    maximum_age: "",
    booking_required: false,
    sort_order: sortOrder,
    is_active: true,
    show_on_discover: true,
    show_on_from: false,
    cost_varied: false,
    prices: [emptyPrice(0)],
  };
}

function priceToDraft(row: ListingPriceOption, sortOrder: number): DraftPrice {
  const applies = asAppliesTo(row.applies_to ?? undefined);
  const name = row.name ?? "";
  const couples = applies === "couple" || (applies === "custom" && /couple/i.test(name));
  return {
    id: row.id,
    clientKey: clientKey("price", row.id),
    name,
    standard_price: asMoney(row.standard_price),
    member_price: asMoney(row.member_price),
    inclusions: asText(row.inclusions),
    applies_to: couples ? "couple" : applies,
    price_category: asPriceCategory(row.price_category ?? undefined),
    discount_rand: asMoney(row.discount_rand),
    discount_percent: asMoney(row.discount_percent),
    group_size: applies === "group" ? asInt(row.minimum_group_size) : "",
    valid_from: asDate(row.valid_from),
    valid_until: asDate(row.valid_until),
    is_active: row.is_active !== false,
    show_on_from: Boolean(row.show_on_from),
    sort_order: row.sort_order ?? sortOrder,
    couples_exclusive: false,
  };
}

function mediaToDraft(rows: ListingMedia[]): DraftMedia[] {
  return [...rows]
    .filter((row) => row.public_url)
    .sort((a, b) => {
      if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    })
    .map((row, index) => ({
      id: row.id,
      public_url: row.public_url as string,
      alt_text: asText(row.alt_text),
      is_cover: Boolean(row.is_cover),
      sort_order: row.sort_order ?? index,
      is_pending: Boolean(row.is_pending),
    }));
}

function activitiesFromListing(listing: ListingDetail): DraftActivity[] {
  const activities = [...(listing.listing_activities ?? [])]
    .filter((row) => row.status !== "archived")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const prices = [...(listing.price_options ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const activityIds = new Set(activities.map((row) => row.id));
  const nested = activities.map((activity, index) => {
    const linked = prices.filter((price) => price.listing_activity_id === activity.id);
    return {
      id: activity.id,
      clientKey: clientKey("activity", activity.id),
      name: activity.name,
      short_description: asText(activity.short_description),
      description: asText(activity.description),
      duration_minutes: asInt(activity.duration_minutes),
      minimum_age: asInt(activity.minimum_age),
      maximum_age: asInt(activity.maximum_age),
      booking_required: Boolean(activity.booking_required),
      sort_order: activity.sort_order ?? index,
      is_active: activity.status !== "archived",
      show_on_discover: activity.show_on_discover !== false,
      show_on_from: Boolean(activity.show_on_from),
      cost_varied: Boolean(activity.cost_varied),
      prices:
        linked.length > 0
          ? linked.map((price, i) => priceToDraft(price, i))
          : [emptyPrice(0)],
    } satisfies DraftActivity;
  });

  const orphans = prices.filter(
    (price) => !price.listing_activity_id || !activityIds.has(price.listing_activity_id),
  );

  if (orphans.length > 0) {
    nested.push({
      id: "",
      clientKey: clientKey("activity", `general-${listing.id}`),
      name: nested.length === 0 ? listing.name || "General" : "General",
      short_description: "",
      description: "",
      duration_minutes: "",
      minimum_age: "",
      maximum_age: "",
      booking_required: Boolean(listing.booking_required),
      sort_order: nested.length,
      is_active: true,
      show_on_discover: true,
      show_on_from: false,
      cost_varied: false,
      prices: orphans.map((price, i) => priceToDraft(price, i)),
    });
  }

  if (nested.length === 0) {
    return [emptyActivity(listing.name || "General", 0)];
  }

  return nested;
}

export function listingToDraft(listing: ListingDetail): ListingDraft {
  const biz = oneBiz(listing);
  const hours = emptyHours().map((row) => {
    const found = (listing.operating_hours ?? []).find((h) => h.day_of_week === row.day_of_week);
    if (!found) return row;
    return {
      day_of_week: row.day_of_week,
      opens_at: asTime(found.opens_at),
      closes_at: asTime(found.closes_at),
      is_closed: Boolean(found.is_closed),
      vacation_opens_at: asTime(found.vacation_opens_at),
      vacation_closes_at: asTime(found.vacation_closes_at),
      vacation_is_closed: Boolean(found.vacation_is_closed),
    };
  });

  const media = mediaToDraft(listing.listing_media ?? []);
  const cover =
    media.find((item) => item.is_cover)?.id ?? media[0]?.id ?? "";

  const primaryScale =
    [...(listing.listing_activity_scales ?? [])].sort(
      (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
    )[0]?.activity_scale_id ?? "";

  const kindIds = [...(listing.listing_activity_kinds ?? [])]
    .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))
    .map((row) => row.activity_kind_id);

  return {
    name: listing.name,
    branch_name: asText(listing.branch_name),
    short_description: asText(listing.short_description),
    description: asText(listing.description),
    phone: asText(listing.phone),
    email: asText(listing.email),
    website_url: asText(listing.website_url),
    booking_url: asText(listing.booking_url),
    street_address_1: asText(listing.street_address_1),
    street_address_2: asText(listing.street_address_2),
    suburb: asText(listing.suburb),
    city: asText(listing.city),
    province: asText(listing.province),
    postal_code: asText(listing.postal_code),
    latitude: asText(listing.latitude != null ? String(listing.latitude) : ""),
    longitude: asText(listing.longitude != null ? String(listing.longitude) : ""),
    maps_url: asText(listing.maps_url),
    booking_required: Boolean(listing.booking_required),
    indoor_outdoor: (listing.indoor_outdoor as ListingDraft["indoor_outdoor"]) || "",
    business_name: asText(biz?.name),
    business_description: asText(biz?.description),
    business_website: asText(biz?.website_url),
    hours,
    activities: activitiesFromListing(listing),
    media,
    social: [
      socialFor("instagram", listing),
      socialFor("facebook", listing),
      socialFor("tiktok", listing),
    ],
    persona_ids: (listing.listing_personas ?? []).map((row) => row.persona_id),
    interest_ids: (listing.listing_interests ?? []).map((row) => row.interest_id),
    interest_keywords: listing.interest_keywords ?? "",
    persona_keywords: listing.persona_keywords ?? "",
    scale_id: primaryScale,
    kind_ids: kindIds,
    cover_media_id: cover,
    authorised_to_submit: Boolean(listing.authorised_to_submit),
    image_rights_granted: Boolean(listing.image_rights_granted),
    terms_accepted: Boolean(listing.terms_accepted),
  };
}

export function activeMedia(draft: ListingDraft) {
  return draft.media.filter((row) => !row._delete);
}

export function stepComplete(draft: ListingDraft, key: StepKey) {
  const media = activeMedia(draft);
  switch (key) {
    case "contact":
      return Boolean(draft.email.trim() || draft.phone.trim());
    case "business":
      return Boolean(draft.name.trim() && draft.description.trim());
    case "location":
      return Boolean(draft.street_address_1.trim() || draft.city.trim());
    case "hours":
      return draft.hours.some((row) => !row.is_closed && row.opens_at && row.closes_at);
    case "prices": {
      const named = draft.activities.filter((row) => row.is_active && row.name.trim());
      return named.some((activity) =>
        activity.prices.some(
          (price) => price.is_active && price.name.trim() && price.member_price.trim() !== "",
        ),
      );
    }
    case "audience":
      return (
        draft.kind_ids.length > 0 &&
        Boolean(draft.scale_id) &&
        (draft.interest_ids.length > 0 || Boolean(draft.interest_keywords.trim()))
      );
    case "photos":
      return media.length > 0 && Boolean(draft.cover_media_id);
    case "review":
      return draft.authorised_to_submit && draft.image_rights_granted && draft.terms_accepted;
    default:
      return false;
  }
}

export function completeness(draft: ListingDraft) {
  const steps = EDITOR_STEPS.map((step) => ({
    ...step,
    done: stepComplete(draft, step.key),
  }));
  const doneCount = steps.filter((step) => step.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    percent: Math.round((doneCount / steps.length) * 100),
    ready: doneCount === steps.length,
  };
}

export function draftToPayload(draft: ListingDraft) {
  const media = activeMedia(draft).map((row, index) => ({
    id: row.id,
    sort_order: index,
    is_cover: draft.cover_media_id ? row.id === draft.cover_media_id : index === 0,
    alt_text: row.alt_text,
  }));
  const deleted_media_ids = draft.media.filter((row) => row._delete && row.id).map((row) => row.id);

  return {
    authorised_to_submit: draft.authorised_to_submit,
    image_rights_granted: draft.image_rights_granted,
    terms_accepted: draft.terms_accepted,
    cover_media_id: draft.cover_media_id || null,
    media,
    deleted_media_ids,
    listing: {
      name: draft.name,
      branch_name: draft.branch_name,
      short_description: draft.short_description,
      description: draft.description,
      phone: draft.phone,
      email: draft.email,
      website_url: draft.website_url,
      booking_url: draft.booking_url,
      street_address_1: draft.street_address_1,
      street_address_2: draft.street_address_2,
      suburb: draft.suburb,
      city: draft.city,
      province: draft.province,
      postal_code: draft.postal_code,
      latitude: draft.latitude,
      longitude: draft.longitude,
      maps_url: draft.maps_url,
      booking_required: draft.booking_required,
      indoor_outdoor: draft.indoor_outdoor || null,
    },
    business: {
      name: draft.business_name.trim() || draft.name.trim(),
      description: draft.business_description,
      website_url: draft.business_website || draft.website_url,
    },
    hours: draft.hours.map((row) => ({
      day_of_week: row.day_of_week,
      opens_at: row.opens_at,
      closes_at: row.closes_at,
      is_closed: row.is_closed,
      vacation_opens_at: row.vacation_opens_at,
      vacation_closes_at: row.vacation_closes_at,
      vacation_is_closed: row.vacation_is_closed,
    })),
    activities: draft.activities.map((activity, activityIndex) => ({
      id: activity.id || null,
      name: activity.name,
      short_description: activity.description.trim() || activity.short_description,
      description: activity.description,
      duration_minutes: activity.duration_minutes,
      minimum_age: activity.minimum_age,
      maximum_age: activity.maximum_age,
      booking_required: activity.booking_required,
      sort_order: activityIndex,
      is_active: activity.is_active,
      show_on_discover: activity.show_on_discover,
      show_on_from: activity.show_on_from,
      cost_varied: activity.cost_varied,
      prices: activity.prices.map((price, priceIndex) => {
        const hasDiscount = Boolean(price.discount_rand.trim() || price.discount_percent.trim());
        return {
          id: price.id || null,
          name: price.name,
          standard_price: price.standard_price,
          member_price: hasDiscount
            ? derivedMemberPrice(price.standard_price, price.discount_rand, price.discount_percent)
            : price.member_price,
          inclusions: price.inclusions,
          applies_to: price.applies_to || "person",
          price_category: price.price_category,
          discount_rand: price.discount_rand,
          discount_percent: price.discount_percent,
          group_size: price.applies_to === "group" ? price.group_size : "",
          valid_from: price.valid_from || null,
          valid_until: price.valid_until || null,
          is_active: price.is_active,
          show_on_from: price.show_on_from,
          sort_order: priceIndex,
        };
      }),
    })),
    persona_ids: draft.persona_ids,
    interest_ids: draft.interest_ids,
    interest_keywords: draft.interest_keywords,
    persona_keywords: draft.persona_keywords,
    scale_ids: draft.scale_id ? [draft.scale_id] : [],
    kind_ids: draft.kind_ids,
    social: draft.social.map((row) => ({
      platform: row.platform,
      handle: row.handle,
      url: row.url,
    })),
  };
}

function pendingRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pendingText(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function pendingBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function pendingIds(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function pendingIndoor(value: unknown): ListingDraft["indoor_outdoor"] {
  if (value === "indoor" || value === "outdoor" || value === "both") return value;
  return "";
}

/** Show unpublished edits in the editor without changing the live listing. */
export function applyPendingPayload(draft: ListingDraft, raw: unknown): ListingDraft {
  const payload = pendingRecord(raw);
  if (!payload) return draft;
  const listing = pendingRecord(payload.listing) ?? {};
  const business = pendingRecord(payload.business) ?? {};
  const next: ListingDraft = { ...draft };

  if (payload.listing) {
    next.name = pendingText(listing.name);
    next.branch_name = pendingText(listing.branch_name);
    next.short_description = pendingText(listing.short_description);
    next.description = pendingText(listing.description);
    next.phone = pendingText(listing.phone);
    next.email = pendingText(listing.email);
    next.website_url = pendingText(listing.website_url);
    next.booking_url = pendingText(listing.booking_url);
    next.street_address_1 = pendingText(listing.street_address_1);
    next.street_address_2 = pendingText(listing.street_address_2);
    next.suburb = pendingText(listing.suburb);
    next.city = pendingText(listing.city);
    next.province = pendingText(listing.province);
    next.postal_code = pendingText(listing.postal_code);
    next.latitude = pendingText(listing.latitude);
    next.longitude = pendingText(listing.longitude);
    next.maps_url = pendingText(listing.maps_url);
    next.booking_required = pendingBool(listing.booking_required, draft.booking_required);
    next.indoor_outdoor = pendingIndoor(listing.indoor_outdoor);
  }

  if (payload.business) {
    next.business_name = pendingText(business.name);
    next.business_description = pendingText(business.description);
    next.business_website = pendingText(business.website_url);
  }

  const pendingHours = payload.hours;
  if (Array.isArray(pendingHours)) {
    next.hours = emptyHours().map((row) => {
      const found = pendingHours.find((item) => {
        const hour = pendingRecord(item);
        return hour ? Number(hour.day_of_week) === row.day_of_week : false;
      });
      const hour = pendingRecord(found);
      if (!hour) return row;
      return {
        day_of_week: row.day_of_week,
        opens_at: asTime(pendingText(hour.opens_at)),
        closes_at: asTime(pendingText(hour.closes_at)),
        is_closed: pendingBool(hour.is_closed, true),
        vacation_opens_at: asTime(pendingText(hour.vacation_opens_at)),
        vacation_closes_at: asTime(pendingText(hour.vacation_closes_at)),
        vacation_is_closed: pendingBool(hour.vacation_is_closed, false),
      };
    });
  }

  if (Array.isArray(payload.activities)) {
    next.activities = payload.activities.map((item, index) => {
      const activity = pendingRecord(item) ?? {};
      const prices = Array.isArray(activity.prices) ? activity.prices : [];
      const id = pendingText(activity.id);
      return {
        id,
        clientKey: clientKey("activity", id || undefined),
        name: pendingText(activity.name),
        short_description: pendingText(activity.short_description),
        description: pendingText(activity.description),
        duration_minutes: asInt(pendingText(activity.duration_minutes)),
        minimum_age: asInt(pendingText(activity.minimum_age)),
        maximum_age: asInt(pendingText(activity.maximum_age)),
        booking_required: pendingBool(activity.booking_required, false),
        sort_order: index,
        is_active: pendingBool(activity.is_active, true),
        show_on_discover: pendingBool(activity.show_on_discover, true),
        show_on_from: pendingBool(activity.show_on_from, false),
        cost_varied: pendingBool(activity.cost_varied, false),
        prices:
          prices.length > 0
            ? prices.map((priceItem, priceIndex) => {
                const price = pendingRecord(priceItem) ?? {};
                const priceId = pendingText(price.id);
                const applies = asAppliesTo(pendingText(price.applies_to));
                return {
                  id: priceId,
                  clientKey: clientKey("price", priceId || undefined),
                  name: pendingText(price.name),
                  standard_price: asMoney(pendingText(price.standard_price)),
                  member_price: asMoney(pendingText(price.member_price)),
                  inclusions: pendingText(price.inclusions),
                  applies_to: applies,
                  price_category: asPriceCategory(pendingText(price.price_category)),
                  discount_rand: asMoney(pendingText(price.discount_rand)),
                  discount_percent: asMoney(pendingText(price.discount_percent)),
                  group_size: applies === "group" ? asInt(pendingText(price.group_size)) : "",
                  valid_from: asDate(pendingText(price.valid_from)),
                  valid_until: asDate(pendingText(price.valid_until)),
                  is_active: pendingBool(price.is_active, true),
                  show_on_from: pendingBool(price.show_on_from, false),
                  sort_order: priceIndex,
                  couples_exclusive: false,
                } satisfies DraftPrice;
              })
            : [emptyPrice(0)],
      } satisfies DraftActivity;
    });
  }

  if (Array.isArray(payload.media)) {
    const deleted = new Set(pendingIds(payload.deleted_media_ids) ?? []);
    const byId = new Map(draft.media.map((row) => [row.id, row]));
    const ordered: DraftMedia[] = [];
    for (const item of payload.media) {
      const media = pendingRecord(item);
      if (!media) continue;
      const existing = byId.get(pendingText(media.id));
      if (!existing) continue;
      ordered.push({
        ...existing,
        alt_text: pendingText(media.alt_text),
        is_cover: pendingBool(media.is_cover, existing.is_cover),
        sort_order: Number(media.sort_order) || ordered.length,
        _delete: false,
      });
      byId.delete(existing.id);
    }
    for (const leftover of byId.values()) {
      ordered.push({ ...leftover, _delete: deleted.has(leftover.id) });
    }
    next.media = ordered;
    const cover = pendingText(payload.cover_media_id);
    const visible = ordered.filter((row) => !row._delete);
    next.cover_media_id =
      (cover && visible.some((row) => row.id === cover) ? cover : "") ||
      visible.find((row) => row.is_cover)?.id ||
      visible[0]?.id ||
      "";
  }

  const pendingSocial = payload.social;
  if (Array.isArray(pendingSocial)) {
    next.social = draft.social.map((row) => {
      const found = pendingSocial.find((item) => {
        const social = pendingRecord(item);
        return social?.platform === row.platform;
      });
      const social = pendingRecord(found);
      if (!social) return row;
      return {
        platform: row.platform,
        handle: pendingText(social.handle),
        url: pendingText(social.url),
      };
    });
  }

  const personaIds = pendingIds(payload.persona_ids);
  const interestIds = pendingIds(payload.interest_ids);
  const kindIds = pendingIds(payload.kind_ids);
  const scaleIds = pendingIds(payload.scale_ids);
  if (personaIds) next.persona_ids = personaIds;
  if (interestIds) next.interest_ids = interestIds;
  if (kindIds) next.kind_ids = kindIds;
  if (scaleIds) next.scale_id = scaleIds[0] ?? "";
  if (typeof payload.interest_keywords === "string") next.interest_keywords = payload.interest_keywords;
  if (typeof payload.persona_keywords === "string") next.persona_keywords = payload.persona_keywords;
  if (typeof payload.authorised_to_submit === "boolean") {
    next.authorised_to_submit = payload.authorised_to_submit;
  }
  if (typeof payload.image_rights_granted === "boolean") {
    next.image_rights_granted = payload.image_rights_granted;
  }
  if (typeof payload.terms_accepted === "boolean") next.terms_accepted = payload.terms_accepted;

  return next;
}

export function draftWithPending(
  listing: ListingDetail,
  catalog: Pick<EditorCatalog, "interests">,
) {
  const next = listingToDraft(listing);
  if (listing.pending_payload) return applyPendingPayload(next, listing.pending_payload);
  if (listing.interest_keywords == null) {
    next.interest_keywords = interestKeywordsFromIds(next.interest_ids, catalog.interests);
  }
  return next;
}

export function previewHours(draft: ListingDraft) {
  return draft.hours.map((row) => ({
    day: formatDay(row.day_of_week),
    hours: formatHours(row.opens_at || null, row.closes_at || null, row.is_closed),
    closed: row.is_closed,
  }));
}

export function priceUnitLabel(applies: PriceAppliesTo | string) {
  if (applies === "person") return "p.p";
  if (applies === "couple") return "per couple";
  if (applies === "adult") return "adult";
  if (applies === "child") return "child";
  if (applies === "pensioner") return "pensioner";
  if (applies === "group") return "group";
  if (applies === "hour") return "/hr";
  if (applies === "item") return "";
  return "";
}

export function formatAppPrice(value: number | null, unit: string, free = false) {
  if (free || value === 0) return "Free";
  if (value === null) return "—";
  const amount = formatRand(value);
  return unit ? `${amount} ${unit}` : amount;
}

export function indoorOutdoorChips(value: ListingDraft["indoor_outdoor"]) {
  if (value === "indoor") return ["Indoor"];
  if (value === "outdoor") return ["Outdoor"];
  if (value === "both") return ["Indoor", "Outdoor"];
  return [];
}

export function previewChips(draft: ListingDraft, catalog: EditorCatalog) {
  const kinds = catalog.kinds
    .filter((kind) => draft.kind_ids.includes(kind.id))
    .sort((a, b) => draft.kind_ids.indexOf(a.id) - draft.kind_ids.indexOf(b.id))
    .map((kind) => kind.title);
  return [...kinds, ...indoorOutdoorChips(draft.indoor_outdoor)];
}

export function previewPrices(draft: ListingDraft, limit = 8) {
  const rows: {
    name: string;
    standard: number | null;
    member: number | null;
    unit: string;
    free: boolean;
    from: boolean;
    varies?: boolean;
  }[] = [];

  for (const activity of draft.activities) {
    if (!activity.is_active || !activity.show_on_discover) continue;
    if (activity.cost_varied) {
      rows.push({
        name: activity.name.trim() || "Activity",
        standard: null,
        member: null,
        unit: "",
        free: false,
        from: false,
        varies: true,
      });
      if (rows.length >= limit) return rows;
      continue;
    }
    for (const price of activity.prices) {
      if (!price.is_active || !price.name.trim()) continue;
      const standardOk = price.standard_price.trim() === "" ? null : Number(price.standard_price);
      const memberOk = price.member_price.trim() === "" ? null : Number(price.member_price);
      const standard = Number.isFinite(standardOk as number) ? standardOk : null;
      const member = Number.isFinite(memberOk as number) ? memberOk : null;
      const free = standard === 0 && (member === 0 || member === null);
      rows.push({
        name: price.name,
        standard,
        member,
        unit: priceUnitLabel(price.applies_to),
        free,
        from: price.show_on_from || activity.show_on_from,
      });
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

export function previewPrice(draft: ListingDraft) {
  const active = previewPrices(draft, 50);
  if (!active.length) return { from: "—", member: null as string | null };
  const standards = active
    .map((row) => row.standard)
    .filter((n): n is number => n !== null);
  const members = active
    .map((row) => row.member)
    .filter((n): n is number => n !== null);
  const from = standards.length ? Math.min(...standards) : null;
  const member = members.length ? Math.min(...members) : null;
  return {
    from: formatRand(from),
    member:
      member !== null && from !== null && member <= from ? formatRand(member) : null,
  };
}

export function statusLegend(status: ListingStatus) {
  return (["draft", "review", "approved", "archived"] as ListingStatus[]).map((item) => ({
    id: item,
    label: listingStatusLabel(item),
    active: item === status,
  }));
}

export function auditLabel(event: AuditEvent) {
  if (event.action === "edit") return "Saved Edits";
  if (event.action === "approve") return "Business Approved";
  if (event.action === "review") return "Submitted for Approval";
  if (event.action === "create") return "Listing Created";
  if (event.action === "draft") return "Changes Requested";
  if (event.action === "archive") return "Archived";
  if (event.action === "suspend") return "Suspended";
  if (event.action === "unsuspend") return "Recovered";
  if (event.action === "feature") return "Featured Candidate";
  return event.action;
}

export function formatPreviewRand(value: number | null) {
  if (value === null) return "—";
  return formatRand(value);
}
