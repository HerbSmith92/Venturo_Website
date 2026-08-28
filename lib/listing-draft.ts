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
};

export type DraftPrice = {
  id: string;
  clientKey: string;
  name: string;
  standard_price: string;
  member_price: string;
  inclusions: string;
  applies_to: PriceAppliesTo;
  price_category: PriceCategory;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
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
  prices: DraftPrice[];
};

export type DraftMedia = {
  id: string;
  public_url: string;
  alt_text: string;
  is_cover: boolean;
  sort_order: number;
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
  scale_id: string;
  kind_ids: string[];
  cover_media_id: string;
  authorised_to_submit: boolean;
  image_rights_granted: boolean;
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
};

export type StepKey =
  | "contact"
  | "business"
  | "hours"
  | "prices"
  | "audience"
  | "photos"
  | "review";

export const EDITOR_STEPS: { key: StepKey; label: string; number: number }[] = [
  { key: "contact", label: "Your Contact", number: 1 },
  { key: "business", label: "The Business", number: 2 },
  { key: "hours", label: "Branch & Hours", number: 3 },
  { key: "prices", label: "Activities & Pricing", number: 4 },
  { key: "audience", label: "Who It's For", number: 5 },
  { key: "photos", label: "Branch Photos", number: 6 },
  { key: "review", label: "Permission & Review", number: 7 },
];

export const APPLIES_TO_OPTIONS: { value: PriceAppliesTo; label: string }[] = [
  { value: "person", label: "Per person" },
  { value: "adult", label: "Adult" },
  { value: "child", label: "Child" },
  { value: "pensioner", label: "Pensioner" },
  { value: "group", label: "Group" },
  { value: "hour", label: "Per hour" },
  { value: "item", label: "Per item" },
  { value: "custom", label: "Custom" },
];

export const PRICE_CATEGORY_OPTIONS: { value: PriceCategory; label: string }[] = [
  { value: "admission", label: "Admission" },
  { value: "activity", label: "Activity" },
  { value: "package", label: "Package" },
  { value: "rental", label: "Rental" },
  { value: "add_on", label: "Add-on" },
  { value: "other", label: "Other" },
];

/** Simplified “Who comes” personas shown in the editor. */
export const WHO_COMES_PERSONAS: { title: string; label: string }[] = [
  { title: "Going Solo", label: "Solo" },
  { title: "Two's Company", label: "Couples" },
  { title: "Family Crew", label: "Families" },
  { title: "With the Squad", label: "Groups" },
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
  return [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day_of_week: day,
    opens_at: "",
    closes_at: "",
    is_closed: true,
  }));
}

export function emptyPrice(sortOrder = 0): DraftPrice {
  return {
    id: "",
    clientKey: clientKey("price"),
    name: "Standard",
    standard_price: "",
    member_price: "",
    inclusions: "",
    applies_to: "person",
    price_category: "admission",
    valid_from: "",
    valid_until: "",
    is_active: true,
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
    prices: [emptyPrice(0)],
  };
}

function priceToDraft(row: ListingPriceOption, sortOrder: number): DraftPrice {
  const applies = asAppliesTo(row.applies_to ?? undefined);
  const name = row.name ?? "";
  const couples =
    applies === "custom" && /couple/i.test(name);
  return {
    id: row.id,
    clientKey: clientKey("price", row.id),
    name,
    standard_price: asMoney(row.standard_price),
    member_price: asMoney(row.member_price),
    inclusions: asText(row.inclusions),
    applies_to: applies,
    price_category: asPriceCategory(row.price_category ?? undefined),
    valid_from: asDate(row.valid_from),
    valid_until: asDate(row.valid_until),
    is_active: row.is_active !== false,
    sort_order: row.sort_order ?? sortOrder,
    couples_exclusive: couples,
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
    };
  });

  const media = mediaToDraft(listing.listing_media ?? []);
  const cover =
    media.find((item) => item.is_cover)?.id ?? media[0]?.id ?? "";

  const primaryScale =
    [...(listing.listing_activity_scales ?? [])].sort(
      (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
    )[0]?.activity_scale_id ?? "";

  const primaryKind =
    [...(listing.listing_activity_kinds ?? [])].sort(
      (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
    )[0]?.activity_kind_id ?? "";

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
    scale_id: primaryScale,
    kind_ids: primaryKind ? [primaryKind] : [],
    cover_media_id: cover,
    authorised_to_submit: Boolean(listing.authorised_to_submit),
    image_rights_granted: Boolean(listing.image_rights_granted),
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
      return Boolean(
        draft.business_name.trim() && draft.name.trim() && draft.short_description.trim(),
      );
    case "hours": {
      const place = draft.street_address_1.trim() || draft.city.trim();
      const openDay = draft.hours.some(
        (row) => !row.is_closed && row.opens_at && row.closes_at,
      );
      return Boolean(place && openDay);
    }
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
        draft.interest_ids.length > 0
      );
    case "photos":
      return media.length > 0 && Boolean(draft.cover_media_id);
    case "review":
      return draft.authorised_to_submit && draft.image_rights_granted;
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
      booking_required: draft.booking_required,
      indoor_outdoor: draft.indoor_outdoor || null,
    },
    business: {
      name: draft.business_name,
      description: draft.business_description,
      website_url: draft.business_website || draft.website_url,
    },
    hours: draft.hours.map((row) => ({
      day_of_week: row.day_of_week,
      opens_at: row.opens_at,
      closes_at: row.closes_at,
      is_closed: row.is_closed,
    })),
    activities: draft.activities.map((activity, activityIndex) => ({
      id: activity.id || null,
      name: activity.name,
      short_description: activity.short_description,
      description: activity.description,
      duration_minutes: activity.duration_minutes,
      minimum_age: activity.minimum_age,
      maximum_age: activity.maximum_age,
      booking_required: activity.booking_required,
      sort_order: activityIndex,
      is_active: activity.is_active,
      prices: activity.prices.map((price, priceIndex) => {
        const couples = price.couples_exclusive;
        const applies_to: PriceAppliesTo = couples ? "custom" : price.applies_to;
        const name =
          couples && !/couple/i.test(price.name)
            ? price.name.trim()
              ? `${price.name.trim()} (Couples)`
              : "Couples exclusive"
            : price.name;
        return {
          id: price.id || null,
          name,
          standard_price: price.standard_price,
          member_price: price.member_price,
          inclusions: price.inclusions,
          applies_to,
          price_category: price.price_category,
          valid_from: price.valid_from || null,
          valid_until: price.valid_until || null,
          is_active: price.is_active,
          sort_order: priceIndex,
        };
      }),
    })),
    persona_ids: draft.persona_ids,
    interest_ids: draft.interest_ids,
    scale_ids: draft.scale_id ? [draft.scale_id] : [],
    kind_ids: draft.kind_ids.slice(0, 1),
    social: draft.social.map((row) => ({
      platform: row.platform,
      handle: row.handle,
      url: row.url,
    })),
  };
}

export function previewHours(draft: ListingDraft) {
  return draft.hours.map((row) => ({
    day: formatDay(row.day_of_week),
    hours: formatHours(row.opens_at || null, row.closes_at || null, row.is_closed),
  }));
}

export function previewPrices(draft: ListingDraft, limit = 4) {
  const rows: {
    name: string;
    standard: number | null;
    member: number | null;
    inclusions: string;
    save: number | null;
  }[] = [];

  for (const activity of draft.activities) {
    if (!activity.is_active) continue;
    for (const price of activity.prices) {
      if (!price.is_active || !price.name.trim()) continue;
      const standard = Number(price.standard_price);
      const member = Number(price.member_price);
      const standardOk = Number.isFinite(standard) ? standard : null;
      const memberOk = Number.isFinite(member) ? member : null;
      const save =
        standardOk !== null && memberOk !== null && memberOk < standardOk
          ? standardOk - memberOk
          : null;
      rows.push({
        name: price.name,
        standard: standardOk,
        member: memberOk,
        inclusions: price.inclusions,
        save,
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
  if (event.action === "edit") return "Saved edits";
  if (event.action === "approve") return "Approved & published";
  if (event.action === "review") return "Moved to review";
  if (event.action === "draft") return "Requested changes";
  if (event.action === "archive") return "Rejected & archived";
  if (event.action === "feature") return "Top Pick updated";
  return event.action;
}

export function formatPreviewRand(value: number | null) {
  if (value === null) return "—";
  return formatRand(value);
}
