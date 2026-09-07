/**
 * Shared event shape for website + app (same Supabase tables).
 *
 * listingImageUrl — Instagram Post 4:5. What's On cards, homepage, app feed.
 * storyImageUrl   — Instagram Story 9:16. App stories & share-to-Stories.
 * bannerUrl       — 16:9 hero on the event page (web + app detail).
 */

export type EventStatus = "draft" | "review" | "approved" | "rejected" | "cancelled";
export type EventVisibility = "public" | "private";
export type TicketKind = "paid" | "free" | "donation";
export type MemberDiscountKind = "none" | "percent" | "amount";

export type EventTicketType = {
  id: string;
  eventId: string;
  name: string;
  kind: TicketKind;
  priceCents: number;
  memberPriceCents: number | null;
  memberDiscountKind: MemberDiscountKind;
  memberDiscountValue: number | null;
  membersOnly: boolean;
  passFeesToBuyer: boolean;
  passCommissionToBuyer: boolean;
  quantity: number;
  soldCount: number;
  sortOrder: number;
};

export type VenturoEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  ageRestriction: string | null;
  audienceGender: string;
  format: string | null;
  category: string | null;
  tags: string[];
  bannerUrl: string | null;
  listingImageUrl: string | null;
  storyImageUrl: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  showMap: boolean;
  visibility: EventVisibility;
  status: EventStatus;
  organiserId: string;
  reviewNote: string | null;
  parking: string | null;
  prohibitedItems: string | null;
  fromPriceCents: number | null;
  memberFromPriceCents: number | null;
  membersOnly: boolean;
  ticketTypes: EventTicketType[];
};

export type PlatformFees = {
  commissionPct: number;
  bookingFeeCents: number;
};

export const EVENT_INTERESTS = [
  "Adventure & Thrills",
  "Nightlife",
  "Amusement Parks",
  "Workshops & Education",
  "Arts & Culture",
  "Parks & Nature",
  "Sports & Wellness",
  "Markets",
  "Sightseeing & Tours",
  "Social Gatherings",
  "Kids Play & Edutainment",
] as const;

/** @deprecated Use EVENT_INTERESTS — kept for public What’s On filters. */
export const EVENT_CATEGORIES = EVENT_INTERESTS;

export const EVENT_PERSONAS = [
  "Everyone",
  "Families",
  "Kids 0–6",
  "Kids 7–12",
  "Teens 14–18",
  "Couples",
  "Solo",
  "Groups",
  "Pet Parents",
  "Bargain Hunters",
] as const;

/** Same five stops members pick in the app (`activity_scales`). */
export const EVENT_ENERGY_SCALES = [
  { rank: 1, title: "Chilled Hang", subtitle: "Slow mornings, long lunches, nowhere to be." },
  { rank: 2, title: "Low Key Adventure", subtitle: "A wander with a pulse." },
  { rank: 3, title: "Up & Active", subtitle: "Move, sweat, grin." },
  { rank: 4, title: "Adrenaline Tease", subtitle: "Heart up. Feet almost off the ground." },
  { rank: 5, title: "Full Throttle", subtitle: "All in. Tell the story later." },
] as const;

export const EVENT_GENDERS = EVENT_PERSONAS;

const ENERGY_MIN = 1;
const ENERGY_MAX = 5;

function clampEnergy(value: number) {
  return Math.min(ENERGY_MAX, Math.max(ENERGY_MIN, value));
}

function energyScale(rank: number) {
  return EVENT_ENERGY_SCALES.find((item) => item.rank === rank);
}

/** Stored on `events.format` as `2-5`. Legacy Low / Medium / High still parse. */
export function parseEventEnergy(format: string | null | undefined): { low: number; high: number } {
  if (!format?.trim()) return { low: 3, high: 3 };
  const range = format.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) {
    const a = clampEnergy(Number(range[1]));
    const b = clampEnergy(Number(range[2]));
    return a <= b ? { low: a, high: b } : { low: b, high: a };
  }
  if (/^\d+$/.test(format.trim())) {
    const n = clampEnergy(Number(format.trim()));
    return { low: n, high: n };
  }
  const key = format.toLowerCase();
  if (key.includes("low") || key.includes("chill")) return { low: 1, high: 2 };
  if (key.includes("high") || key.includes("throttle") || key.includes("thrill")) {
    return { low: 4, high: 5 };
  }
  if (key.includes("medium") || key.includes("active")) return { low: 3, high: 3 };
  return { low: 2, high: 3 };
}

export function serializeEventEnergy(low: number, high: number) {
  return `${clampEnergy(low)}-${clampEnergy(high)}`;
}

export function pickEnergyRange(
  low: number | null,
  high: number | null,
  rank: number,
): { low: number; high: number } {
  if (low == null || high == null) return { low: rank, high: rank };
  if (rank < low) return { low: rank, high };
  if (rank > high) return { low, high: rank };
  return { low: rank, high: rank };
}

export function formatEventEnergy(format: string | null | undefined) {
  const { low, high } = parseEventEnergy(format);
  const lowTitle = energyScale(low)?.title ?? `Level ${low}`;
  const highTitle = energyScale(high)?.title ?? `Level ${high}`;
  return low === high ? lowTitle : `${lowTitle} – ${highTitle}`;
}

export function parseEventPersonas(value: string | null | undefined): string[] {
  const parts = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Everyone"];
}

export function serializeEventPersonas(items: string[]) {
  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  return unique.length ? unique.join(", ") : "Everyone";
}

export function toggleEventPersona(selected: string[], persona: string, max = 4) {
  if (persona === "Everyone") return ["Everyone"];
  const withoutEveryone = selected.filter((item) => item !== "Everyone");
  if (withoutEveryone.includes(persona)) {
    const next = withoutEveryone.filter((item) => item !== persona);
    return next.length ? next : ["Everyone"];
  }
  if (withoutEveryone.length >= max) return withoutEveryone;
  return [...withoutEveryone, persona];
}

export function withCurrentOption(options: readonly string[], value: string) {
  if (!value || options.includes(value)) return [...options];
  return [value, ...options];
}

export const SUGGESTED_EVENT_TAGS = [
  "Hiking",
  "Sunrise",
  "Coffee",
  "Braai",
  "Beach",
  "Live Music",
  "Outdoors",
  "Nightlife",
  "Workshop",
  "Markets",
  "Family",
  "Food",
  "Wellness",
  "Thrills",
  "Art",
  "Sports",
  "Picnic",
  "Date Night",
  "Pop-up",
  "Run Club",
] as const;

export const EVENT_IMAGE_SPECS = {
  listing: {
    kind: "listing" as const,
    label: "Feed Post",
    ratio: "4:5",
    size: "1080 × 1350",
    hint: "Instagram Post — the card people tap in What's On & the app feed.",
  },
  story: {
    kind: "story" as const,
    label: "Story",
    ratio: "9:16",
    size: "1080 × 1920",
    hint: "Optional. App story reel & share-to-Stories.",
  },
  banner: {
    kind: "banner" as const,
    label: "Event Page",
    ratio: "16:9",
    size: "1920 × 1080",
    hint: "Wide header on the event page & this studio.",
  },
} as const;

export const EVENT_IMAGE_MAX_MB = 10;
export const EVENT_IMAGE_MAX_BYTES = EVENT_IMAGE_MAX_MB * 1024 * 1024;

export type EventImageKind = keyof typeof EVENT_IMAGE_SPECS;

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";

/** Always `R 00.00` — same cost format as the directory. */
export function formatCents(cents: number) {
  const rands = cents / 100;
  return `R ${rands.toFixed(2)}`;
}

export function formatEventFromPrice(cents: number | null) {
  if (cents === null) return null;
  if (cents === 0) return "Free";
  return `From ${formatCents(cents)}`;
}

export function parseRandsToCents(value: string) {
  const n = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function memberPriceCentsFromDiscount(
  listCents: number,
  kind: MemberDiscountKind,
  value: number,
): number | null {
  if (kind === "none" || !Number.isFinite(value) || value <= 0) return null;
  if (kind === "percent") {
    const pct = Math.min(100, value);
    return Math.max(0, Math.round(listCents * (1 - pct / 100)));
  }
  return Math.max(0, listCents - Math.round(value * 100));
}

export function formatEventWhen(startsAt: string, timezone = "Africa/Johannesburg") {
  if (!startsAt) return "Date coming";
  try {
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(startsAt));
  } catch {
    return startsAt;
  }
}

function eventParts(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((item) => item.type === type)?.value ?? "";
}

/** Howler-style window: `26 Sep 2026 · 10:00–12:00` (or spanning days). */
export function formatEventWindow(
  startsAt: string,
  endsAt: string,
  timezone = "Africa/Johannesburg",
) {
  if (!startsAt) return "Add date & time";
  try {
    const start = eventParts(startsAt, timezone);
    const end = endsAt ? eventParts(endsAt, timezone) : null;
    const startDay = `${part(start, "day")} ${part(start, "month")} ${part(start, "year")}`;
    const startTime = `${part(start, "hour")}:${part(start, "minute")}`;
    if (!end) return `${startDay} · ${startTime}`;
    const endDay = `${part(end, "day")} ${part(end, "month")} ${part(end, "year")}`;
    const endTime = `${part(end, "hour")}:${part(end, "minute")}`;
    if (startDay === endDay) return `${startDay} · ${startTime}–${endTime}`;
    return `${startDay} ${startTime} – ${endDay} ${endTime}`;
  } catch {
    return formatEventWhen(startsAt, timezone);
  }
}

/** datetime-local value in Africa/Johannesburg wall time. */
export function isoToDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Interpret a datetime-local string as SAST (UTC+2, no DST). */
export function datetimeLocalToIso(value: string) {
  if (!value) return "";
  const [date, time] = value.split("T");
  if (!date || !time) return "";
  const iso = new Date(`${date}T${time}:00+02:00`);
  return Number.isNaN(iso.getTime()) ? "" : iso.toISOString();
}

export function remainingTickets(ticket: EventTicketType) {
  return Math.max(0, ticket.quantity - ticket.soldCount);
}

export function unitPriceCents(ticket: EventTicketType, paidMember: boolean) {
  if (paidMember && ticket.memberPriceCents !== null) return ticket.memberPriceCents;
  if (ticket.membersOnly) return ticket.memberPriceCents ?? ticket.priceCents;
  return ticket.priceCents;
}

export function eventFeedImage(
  event: Pick<VenturoEvent, "listingImageUrl" | "bannerUrl" | "storyImageUrl">,
) {
  return event.listingImageUrl || event.bannerUrl || event.storyImageUrl || FALLBACK_IMAGE;
}

export function eventHeroImage(
  event: Pick<VenturoEvent, "listingImageUrl" | "bannerUrl" | "storyImageUrl">,
) {
  return event.bannerUrl || event.listingImageUrl || event.storyImageUrl || FALLBACK_IMAGE;
}

export function eventStoryImage(
  event: Pick<VenturoEvent, "listingImageUrl" | "bannerUrl" | "storyImageUrl">,
) {
  return event.storyImageUrl || event.listingImageUrl || event.bannerUrl || FALLBACK_IMAGE;
}

/** @deprecated Use eventFeedImage — kept so existing imports keep working. */
export function eventImage(
  event: Pick<VenturoEvent, "listingImageUrl" | "bannerUrl" | "storyImageUrl">,
) {
  return eventFeedImage(event);
}

export function eventAddressText(
  event: Pick<
    VenturoEvent,
    "venueName" | "addressLine1" | "addressLine2" | "city" | "postalCode" | "country"
  >,
) {
  return [event.addressLine1, event.addressLine2, event.city, event.postalCode, event.country]
    .filter(Boolean)
    .join(", ");
}

export function mapsQuery(
  event: Pick<
    VenturoEvent,
    "venueName" | "addressLine1" | "addressLine2" | "city" | "postalCode" | "country"
  >,
) {
  return [event.venueName, eventAddressText(event)].filter(Boolean).join(", ");
}

export function slugifyTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
