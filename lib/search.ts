import "server-only";

import {
  loadAudienceViewer,
  parseContentAudience,
  type AudienceViewer,
  type ContentAudience,
} from "@/lib/audience";
import { listVisiblePublishedCommunities } from "@/lib/communities";
import {
  EVENT_ENERGY_SCALES,
  formatEventEnergy,
  parseEventEnergy,
  type VenturoEvent,
} from "@/lib/event-types";
import { listPublicEvents } from "@/lib/events";
import {
  categoryLabel,
  filterListingsForViewer,
  loadPublicCatalogListings,
  type Listing,
} from "@/lib/listings";
import {
  parseSetting,
  settingLabel,
  settingMatches,
  type IndoorOutdoorSetting,
} from "@/lib/setting";

export type SearchTab = "all" | "activities" | "events" | "communities";

export type SearchQuery = {
  q?: string;
  place?: string;
  lat?: string;
  lng?: string;
  tab?: string;
  /** Comma-separated or repeated indoor|outdoor|both */
  setting?: string | string[];
  levelMin?: string;
  levelMax?: string;
  page?: string;
  pageSize?: number;
  /**
   * UI hint only — never used for access control.
   * Gender rows deep-link with audience=women|men.
   */
  audience?: string;
};

export type SearchResultKind = "activity" | "event" | "community";

export type SearchResultCard = {
  kind: SearchResultKind;
  id: string;
  slug: string;
  href: string;
  title: string;
  image: string | null;
  location: string | null;
  setting: IndoorOutdoorSetting | null;
  settingLabel: string | null;
  adventureLabel: string | null;
  startsAt: string | null;
  timezone: string | null;
  audience: ContentAudience;
  kicker: string;
};

export type SearchResponse = {
  results: SearchResultCard[];
  counts: {
    total: number;
    activities: number;
    events: number;
    communities: number;
  };
  page: number;
  pageSize: number;
  pageCount: number;
  tab: SearchTab;
  applied: {
    q: string;
    place: string;
    lat: string | null;
    lng: string | null;
    settings: IndoorOutdoorSetting[];
    levelMin: number | null;
    levelMax: number | null;
    /** Echo of URL hint only — not access control. */
    audienceHint: ContentAudience | null;
  };
};

const DEFAULT_PAGE_SIZE = 24;
const FALLBACK_IMAGE = "/brand/images/climbing.jpg";

export function parseSearchTab(value: string | null | undefined): SearchTab {
  if (value === "activities" || value === "events" || value === "communities") return value;
  return "all";
}

export function parseSettingMulti(value: string | string[] | undefined): IndoorOutdoorSetting[] {
  const raw = Array.isArray(value)
    ? value.flatMap((item) => item.split(","))
    : (value ?? "").split(",");
  const out: IndoorOutdoorSetting[] = [];
  for (const part of raw) {
    const parsed = parseSetting(part.trim());
    if (parsed && !out.includes(parsed)) out.push(parsed);
  }
  return out;
}

function parseLevel(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Adventure range: any assigned rank in range; unassigned excluded when range set. */
export function listingAdventureMatches(
  ranks: number[],
  levelMin: number | null,
  levelMax: number | null,
): boolean {
  if (levelMin == null && levelMax == null) return true;
  if (!ranks.length) return false;
  const min = levelMin ?? 1;
  const max = levelMax ?? 5;
  return ranks.some((rank) => rank >= min && rank <= max);
}

/**
 * Event energy range overlaps selected min–max.
 * Empty/null format = unassigned → excluded when a range is set.
 */
export function eventAdventureMatches(
  format: string | null | undefined,
  levelMin: number | null,
  levelMax: number | null,
): boolean {
  if (levelMin == null && levelMax == null) return true;
  if (!format?.trim()) return false;
  const { low, high } = parseEventEnergy(format);
  const min = levelMin ?? 1;
  const max = levelMax ?? 5;
  return low <= max && min <= high;
}

export function adventureLabelFromRanks(ranks: number[]): string | null {
  if (!ranks.length) return null;
  const low = Math.min(...ranks);
  const high = Math.max(...ranks);
  return formatEventEnergy(`${low}-${high}`);
}

export function adventureLevelTitle(rank: number): string {
  return EVENT_ENERGY_SCALES.find((item) => item.rank === rank)?.title ?? `Level ${rank}`;
}

function matchesPlaceText(haystack: string, place: string) {
  const needle = place.trim().toLowerCase();
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle);
}

function matchesQueryText(haystack: string, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle);
}

function matchesAudienceHint(audience: ContentAudience, hint: ContentAudience | null) {
  if (!hint) return true;
  return audience === hint;
}

function listingToCard(listing: Listing): SearchResultCard {
  return {
    kind: "activity",
    id: listing.id,
    slug: listing.slug,
    href: `/directory/${listing.slug}`,
    title: listing.name,
    image: listing.image || FALLBACK_IMAGE,
    location: [listing.area, listing.city].filter(Boolean).join(", ") || null,
    setting: listing.indoorOutdoor,
    settingLabel: settingLabel(listing.indoorOutdoor),
    adventureLabel: adventureLabelFromRanks(listing.adventureRanks),
    startsAt: null,
    timezone: null,
    audience: listing.audience,
    kicker: categoryLabel(listing.category) || "Activity",
  };
}

function eventToCard(event: VenturoEvent): SearchResultCard {
  const location =
    [event.venueName, event.city].filter(Boolean).join(", ") || event.city || null;
  return {
    kind: "event",
    id: event.id,
    slug: event.slug,
    href: `/events/${event.slug}${event.startsAt ? `?on=${encodeURIComponent(event.startsAt)}` : ""}`,
    title: event.title,
    image: event.listingImageUrl || event.bannerUrl || FALLBACK_IMAGE,
    location,
    setting: event.indoorOutdoor,
    settingLabel: settingLabel(event.indoorOutdoor),
    adventureLabel: event.format?.trim() ? formatEventEnergy(event.format) : null,
    startsAt: event.startsAt,
    timezone: event.timezone || "Africa/Johannesburg",
    audience: event.audience,
    kicker: event.category || "Event",
  };
}

function communityToCard(community: {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  placeLabel: string | null;
  interest: string | null;
  areas?: string[];
  about?: string | null;
  audience: ContentAudience;
}): SearchResultCard {
  return {
    kind: "community",
    id: community.id,
    slug: community.slug,
    href: `/communities/${community.slug}`,
    title: community.title,
    image: community.coverUrl,
    location: community.placeLabel || "South Africa",
    setting: null,
    settingLabel: null,
    adventureLabel: null,
    startsAt: null,
    timezone: null,
    audience: community.audience,
    kicker: community.interest || "Community",
  };
}

export async function runPublicSearch(
  query: SearchQuery,
  viewer?: AudienceViewer,
): Promise<SearchResponse> {
  const resolvedViewer = viewer ?? (await loadAudienceViewer());
  const tab = parseSearchTab(query.tab);
  const settings = parseSettingMulti(query.setting);
  const levelMin = parseLevel(query.levelMin);
  const levelMax = parseLevel(query.levelMax);
  const q = (query.q ?? "").trim();
  const place = (query.place ?? "").trim();
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  const origin =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const pageSize = Math.min(48, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const page = Math.max(1, Number(query.page) || 1);
  const audienceHint =
    query.audience === "women" || query.audience === "men"
      ? parseContentAudience(query.audience)
      : null;

  const wantActivities = tab === "all" || tab === "activities";
  const wantEvents = tab === "all" || tab === "events";
  const wantCommunities = tab === "all" || tab === "communities";

  const [listingsRaw, eventsRaw, communitiesRaw] = await Promise.all([
    wantActivities
      ? loadPublicCatalogListings().then((rows) =>
          filterListingsForViewer(rows, resolvedViewer),
        )
      : Promise.resolve([] as Listing[]),
    wantEvents
      ? listPublicEvents({
          when: "upcoming",
          viewer: resolvedViewer,
        })
      : Promise.resolve([] as VenturoEvent[]),
    wantCommunities
      ? listVisiblePublishedCommunities(resolvedViewer)
      : Promise.resolve([]),
  ]);

  let activities = listingsRaw.filter((listing) => {
    if (!matchesQueryText(`${listing.name} ${listing.vibe} ${listing.area} ${listing.city}`, q)) {
      return false;
    }
    if (!matchesPlaceText(`${listing.area} ${listing.city}`, place)) return false;
    if (!settingMatches(listing.indoorOutdoor, settings)) return false;
    if (!listingAdventureMatches(listing.adventureRanks, levelMin, levelMax)) return false;
    if (!matchesAudienceHint(listing.audience, audienceHint)) return false;
    return true;
  });

  let events = eventsRaw.filter((event) => {
    if (
      !matchesQueryText(
        `${event.title} ${event.city ?? ""} ${event.venueName ?? ""} ${event.category ?? ""}`,
        q,
      )
    ) {
      return false;
    }
    if (
      !matchesPlaceText(
        `${event.city ?? ""} ${event.venueName ?? ""} ${event.addressLine1 ?? ""}`,
        place,
      )
    ) {
      return false;
    }
    if (!settingMatches(event.indoorOutdoor, settings)) return false;
    if (!eventAdventureMatches(event.format, levelMin, levelMax)) return false;
    if (!matchesAudienceHint(event.audience, audienceHint)) return false;
    return true;
  });

  let communities = communitiesRaw.filter((community) => {
    if (
      !matchesQueryText(
        `${community.title} ${community.placeLabel ?? ""} ${community.interest ?? ""} ${community.about ?? ""}`,
        q,
      )
    ) {
      return false;
    }
    if (
      !matchesPlaceText(
        `${community.placeLabel ?? ""} ${(community.areas ?? []).join(" ")}`,
        place,
      )
    ) {
      return false;
    }
    // AND across categories: communities have no setting/adventure → exclude when those filters are set
    if (settings.length) return false;
    if (levelMin != null || levelMax != null) return false;
    if (!matchesAudienceHint(community.audience, audienceHint)) return false;
    return true;
  });

  if (origin) {
    activities = [...activities].sort((a, b) => {
      const aKm =
        a.latitude != null && a.longitude != null
          ? distanceKm(origin.lat, origin.lng, a.latitude, a.longitude)
          : 9999;
      const bKm =
        b.latitude != null && b.longitude != null
          ? distanceKm(origin.lat, origin.lng, b.latitude, b.longitude)
          : 9999;
      return aKm - bKm;
    });
    events = [...events].sort((a, b) => {
      const aKm =
        a.latitude != null && a.longitude != null
          ? distanceKm(origin.lat, origin.lng, a.latitude, a.longitude)
          : 9999;
      const bKm =
        b.latitude != null && b.longitude != null
          ? distanceKm(origin.lat, origin.lng, b.latitude, b.longitude)
          : 9999;
      return aKm - bKm;
    });
  }

  const activityCards = activities.map(listingToCard);
  const eventCards = events.map(eventToCard);
  const communityCards = communities.map(communityToCard);

  const counts = {
    activities: activityCards.length,
    events: eventCards.length,
    communities: communityCards.length,
    total: 0,
  };

  let merged: SearchResultCard[] = [];
  if (tab === "activities") merged = activityCards;
  else if (tab === "events") merged = eventCards;
  else if (tab === "communities") merged = communityCards;
  else {
    const a = [...activityCards];
    const e = [...eventCards];
    while (a.length || e.length) {
      if (a.length) merged.push(a.shift()!);
      if (e.length) merged.push(e.shift()!);
    }
    merged = [...merged, ...communityCards];
  }

  counts.total = merged.length;
  const pageCount = Math.max(1, Math.ceil(counts.total / pageSize) || 1);
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const results = merged.slice(start, start + pageSize);

  return {
    results,
    counts,
    page: safePage,
    pageSize,
    pageCount,
    tab,
    applied: {
      q,
      place,
      lat: origin ? String(origin.lat) : query.lat?.trim() || null,
      lng: origin ? String(origin.lng) : query.lng?.trim() || null,
      settings,
      levelMin,
      levelMax,
      audienceHint,
    },
  };
}

export function searchParamsFromQuery(query: SearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.place?.trim()) params.set("place", query.place.trim());
  if (query.lat) params.set("lat", query.lat);
  if (query.lng) params.set("lng", query.lng);
  const tab = parseSearchTab(query.tab);
  if (tab !== "all") params.set("tab", tab);
  const settings = parseSettingMulti(query.setting);
  if (settings.length) params.set("setting", settings.join(","));
  if (query.levelMin) params.set("levelMin", query.levelMin);
  if (query.levelMax) params.set("levelMax", query.levelMax);
  if (query.page && Number(query.page) > 1) params.set("page", String(query.page));
  if (query.audience === "women" || query.audience === "men") {
    params.set("audience", query.audience);
  }
  return params;
}
