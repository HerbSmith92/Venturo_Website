import {
  EVENT_ENERGY_SCALES,
  EVENT_INTERESTS,
  EVENT_PERSONAS,
  parseEventEnergy,
  parseEventPersonas,
} from "@/lib/event-types";
import { GUIDE_FILL_LIMIT, GUIDE_NEAR_KM, distanceKm, guideFillSummary } from "@/lib/guide-shared";

export const SUGGESTED_EVENT_GUIDE_TITLES = [
  "What’s On This Weekend",
  "Family Events This Weekend",
  "Cheap Dates This Week",
  "Nights Out Near You",
  "Something Different This Week",
  "Get Outdoors This Weekend",
] as const;

export type EventGuideAudience = {
  interestLabels: string[];
  personaLabels: string[];
  energyRanks: number[];
};

export type EventGuidePreview = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  audienceGender: string;
  format: string | null;
  tags: string[];
  startsAt: string;
  timezone: string;
  venueName: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
  fromPriceCents: number | null;
  status: string;
};

export type EventGuideDraftItem = {
  event_id: string;
  editorial_note: string;
  event: EventGuidePreview | null;
};

export type EventGuideDraft = {
  title: string;
  intro: string;
  body: string;
  shape: "roundup" | "spotlight";
  author_id: string;
  publish_at: string;
  expire_at: string;
  interest_labels: string[];
  persona_labels: string[];
  energy_ranks: number[];
  items: EventGuideDraftItem[];
};

export function eventGuideHasAudience(audience: EventGuideAudience) {
  return Boolean(
    audience.interestLabels.some(Boolean) ||
      audience.personaLabels.filter((label) => label && label !== "Everyone").length ||
      audience.energyRanks.length,
  );
}

export function eventMatchesGuideAudience(
  event: {
    category?: string | null;
    tags?: string[] | null;
    audienceGender?: string | null;
    format?: string | null;
  },
  audience: EventGuideAudience,
) {
  const interests = audience.interestLabels.map((item) => item.trim()).filter(Boolean);
  const personas = audience.personaLabels
    .map((item) => item.trim())
    .filter((item) => item && item !== "Everyone");
  const ranks = audience.energyRanks.filter((rank) => rank >= 1 && rank <= 5);

  if (interests.length) {
    const category = (event.category ?? "").trim();
    const tags = (event.tags ?? []).map((tag) => tag.trim().toLowerCase());
    const hit = interests.some((label) => {
      const needle = label.toLowerCase();
      return category.toLowerCase() === needle || tags.includes(needle);
    });
    if (!hit) return false;
  }

  if (personas.length) {
    const have = parseEventPersonas(event.audienceGender).filter((item) => item !== "Everyone");
    if (!have.some((item) => personas.includes(item))) return false;
  }

  if (ranks.length) {
    const energy = parseEventEnergy(event.format);
    if (!ranks.some((rank) => rank >= energy.low && rank <= energy.high)) return false;
  }

  return true;
}

export function pickEventGuideMatches<
  T extends {
    title: string;
    fromPriceCents: number | null;
    latitude?: number | null;
    longitude?: number | null;
  },
>(
  rows: T[],
  input: {
    maxPriceCents?: number | null;
    lat?: number | null;
    lng?: number | null;
    radiusKm?: number;
    limit?: number;
  },
) {
  const maxPrice =
    input.maxPriceCents != null && Number.isFinite(input.maxPriceCents) && input.maxPriceCents > 0
      ? input.maxPriceCents
      : null;
  const limit = input.limit ?? GUIDE_FILL_LIMIT;
  const hasPlace = input.lat != null && input.lng != null;
  const radius = input.radiusKm ?? GUIDE_NEAR_KM;
  const matches = rows.flatMap((row) => {
    const price = row.fromPriceCents;
    if (maxPrice != null && (price == null || price > maxPrice)) return [];
    const lat = row.latitude;
    const lng = row.longitude;
    const km =
      hasPlace && lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
        ? distanceKm(input.lat as number, input.lng as number, lat, lng)
        : null;
    if (hasPlace && (km == null || km > radius)) return [];
    return [{ row, price: price ?? Number.POSITIVE_INFINITY, km: km ?? Number.POSITIVE_INFINITY }];
  });
  matches.sort((a, b) => {
    if (hasPlace && a.km !== b.km) return a.km - b.km;
    if (a.price !== b.price) return a.price - b.price;
    return a.row.title.localeCompare(b.row.title);
  });
  return {
    total: matches.length,
    matches: matches.slice(0, limit).map((item) => item.row),
  };
}

export function eventGuideFillSummary(
  shown: number,
  total: number,
  amountRands: number | null,
  placeName: string | null,
  audience: string | null,
) {
  return guideFillSummary(shown, total, amountRands, placeName, audience);
}

export function eventGuideAudienceLabels(audience: EventGuideAudience): string[] {
  const energy = audience.energyRanks.flatMap((rank) => {
    const title = EVENT_ENERGY_SCALES.find((item) => item.rank === rank)?.title;
    return title ? [title] : [];
  });
  return [
    ...audience.interestLabels.filter((label) =>
      (EVENT_INTERESTS as readonly string[]).includes(label),
    ),
    ...audience.personaLabels.filter(
      (label) => label !== "Everyone" && (EVENT_PERSONAS as readonly string[]).includes(label),
    ),
    ...energy,
  ];
}
