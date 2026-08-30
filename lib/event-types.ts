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
  fromPriceCents: number | null;
  memberFromPriceCents: number | null;
  membersOnly: boolean;
  ticketTypes: EventTicketType[];
};

export type PlatformFees = {
  commissionPct: number;
  bookingFeeCents: number;
};

export const EVENT_CATEGORIES = [
  "Adventure",
  "Music",
  "Social Gathering",
  "Workshop",
  "Markets",
  "Nightlife",
  "Family",
  "Sports",
  "Food & Drink",
  "Other",
] as const;

export const EVENT_GENDERS = ["Everyone", "Women", "Men", "Mixed"] as const;

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
    label: "Hero Banner",
    ratio: "16:9",
    size: "1920 × 1080",
    hint: "Wide event-page header. Falls back to the Feed Post if you skip it.",
  },
} as const;

export type EventImageKind = keyof typeof EVENT_IMAGE_SPECS;

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";

/** Always `R 00.00` — same cost format as the directory. */
export function formatCents(cents: number) {
  const rands = cents / 100;
  return `R ${rands.toFixed(2)}`;
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
