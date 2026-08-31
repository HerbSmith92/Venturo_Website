import { loadMemberProfile } from "@/lib/profile";
import {
  featuredListings,
  type Listing,
  CATEGORIES,
  type CategoryId,
} from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";
const NEAR_FULL_KM = 15;
const NEAR_MAX_KM = 60;

export type MadeForYouResult = {
  listings: Listing[];
  mode: "personalised" | "teaser";
  placeName: string | null;
};

type ScoreableRow = {
  id: string;
  name: string;
  slug: string;
  suburb: string | null;
  city: string | null;
  short_description: string | null;
  price_from: number | string | null;
  is_featured: boolean | null;
  latitude: number | string | null;
  longitude: number | string | null;
  listing_media?: { public_url: string | null; is_cover: boolean | null; sort_order: number | null }[];
  listing_activity_kinds?: {
    is_primary: boolean | null;
    activity_kinds?: { key: string | null } | { key: string | null }[] | null;
  }[];
  listing_interests?: { interest_id: string | null }[];
  listing_personas?: { persona_id: string | null }[];
  listing_activity_scales?: {
    is_primary: boolean | null;
    activity_scales?: { rank: number | null } | { rank: number | null }[] | null;
  }[];
  price_options?: {
    standard_price: number | string | null;
    member_price: number | string | null;
    is_active: boolean | null;
  }[];
};

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function kindKey(
  entry: NonNullable<ScoreableRow["listing_activity_kinds"]>[number],
): string | null {
  const kind = entry.activity_kinds;
  if (!kind) return null;
  return Array.isArray(kind) ? (kind[0]?.key ?? null) : (kind.key ?? null);
}

function scaleRanks(row: ScoreableRow): number[] {
  const ranks: number[] = [];
  for (const entry of row.listing_activity_scales ?? []) {
    const scale = entry.activity_scales;
    const rank = Array.isArray(scale) ? scale[0]?.rank : scale?.rank;
    if (typeof rank === "number" && Number.isFinite(rank)) ranks.push(rank);
  }
  return ranks;
}

function mapToListing(row: ScoreableRow): Listing {
  const kinds = [...(row.listing_activity_kinds ?? [])].sort(
    (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
  );
  const rawKey = kinds.map(kindKey).find((key): key is string => Boolean(key));
  const categoryIds = new Set(CATEGORIES.map((item) => item.id));
  const category: CategoryId =
    rawKey && categoryIds.has(rawKey as CategoryId) ? (rawKey as CategoryId) : "adventure";

  const media = [...(row.listing_media ?? [])].sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const image = media.find((item) => item.public_url)?.public_url ?? FALLBACK_IMAGE;

  const fromListed = asNumber(row.price_from) ?? 0;
  const activePrices = (row.price_options ?? []).filter((item) => item.is_active !== false);
  const memberPrices = activePrices
    .map((item) => asNumber(item.member_price))
    .filter((n): n is number => n !== null);
  const memberFromPrice = memberPrices.length ? Math.min(...memberPrices) : null;

  const vibe = (row.short_description ?? "").trim().replace(/\s+/g, " ");
  const area = (row.suburb ?? row.city ?? "South Africa").replace(/,$/, "").trim();
  const city = (row.city ?? area).replace(/,$/, "").trim();

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    area,
    city,
    category,
    vibe: vibe.length > 72 ? `${vibe.slice(0, 69)}…` : vibe || "Open the directory",
    energy: "Medium",
    fromPrice: fromListed,
    memberFromPrice:
      memberFromPrice !== null && memberFromPrice < fromListed ? memberFromPrice : null,
    image,
    featured: Boolean(row.is_featured),
  };
}

function scoreListing(
  row: ScoreableRow,
  input: {
    interestIds: Set<string>;
    personaIds: Set<string>;
    energyLow: number | null;
    energyHigh: number | null;
    homeLat: number | null;
    homeLng: number | null;
  },
) {
  let score = 0;

  const listingInterests = (row.listing_interests ?? [])
    .map((item) => item.interest_id)
    .filter((id): id is string => Boolean(id));
  const interestHits = listingInterests.filter((id) => input.interestIds.has(id)).length;
  if (input.interestIds.size > 0 && interestHits > 0) {
    score += Math.min(40, (interestHits / Math.min(input.interestIds.size, 3)) * 40);
  }

  const listingPersonas = (row.listing_personas ?? [])
    .map((item) => item.persona_id)
    .filter((id): id is string => Boolean(id));
  const personaHits = listingPersonas.filter((id) => input.personaIds.has(id)).length;
  if (input.personaIds.size > 0 && personaHits > 0) {
    score += Math.min(25, personaHits * 12.5);
  }

  const ranks = scaleRanks(row);
  if (input.energyLow != null && input.energyHigh != null && ranks.length > 0) {
    const inRange = ranks.some((rank) => rank >= input.energyLow! && rank <= input.energyHigh!);
    if (inRange) {
      score += 20;
    } else {
      const nearest = Math.min(
        ...ranks.map((rank) =>
          Math.min(Math.abs(rank - input.energyLow!), Math.abs(rank - input.energyHigh!)),
        ),
      );
      if (nearest === 1) score += 8;
    }
  }

  const lat = asNumber(row.latitude);
  const lng = asNumber(row.longitude);
  if (
    input.homeLat != null &&
    input.homeLng != null &&
    lat != null &&
    lng != null
  ) {
    const km = haversineKm(input.homeLat, input.homeLng, lat, lng);
    if (km <= NEAR_FULL_KM) score += 15;
    else if (km <= NEAR_MAX_KM) {
      score += 15 * (1 - (km - NEAR_FULL_KM) / (NEAR_MAX_KM - NEAR_FULL_KM));
    }
  }

  return score;
}

async function loadScoreableListings(): Promise<ScoreableRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("directory_listings")
    .select(
      `
      id,
      name,
      slug,
      suburb,
      city,
      short_description,
      price_from,
      is_featured,
      latitude,
      longitude,
      listing_media ( public_url, is_cover, sort_order ),
      listing_activity_kinds ( is_primary, activity_kinds ( key ) ),
      listing_interests ( interest_id ),
      listing_personas ( persona_id ),
      listing_activity_scales ( is_primary, activity_scales ( rank ) ),
      price_options ( standard_price, member_price, is_active )
    `,
    )
    .eq("status", "approved")
    .order("name");

  if (error || !data) return [];
  return data as ScoreableRow[];
}

async function loadHomeCoords(placeId: string | null) {
  if (!placeId) return { lat: null as number | null, lng: null as number | null, name: null as string | null };
  const supabase = await createClient();
  if (!supabase) return { lat: null, lng: null, name: null };

  const { data } = await supabase
    .from("places")
    .select("name, lat, lng")
    .eq("id", placeId)
    .maybeSingle();

  return {
    lat: asNumber(data?.lat ?? null),
    lng: asNumber(data?.lng ?? null),
    name: typeof data?.name === "string" ? data.name : null,
  };
}

/**
 * Paid members with a usable profile get ranked picks.
 * Free users (and cold-start paid) get the Top Picks / featured teaser.
 */
export async function madeForYouListings(options: {
  userId: string | null;
  paid: boolean;
  limit?: number;
}): Promise<MadeForYouResult> {
  const limit = options.limit ?? 4;
  const teaser = async (placeName: string | null = null): Promise<MadeForYouResult> => ({
    listings: (await featuredListings()).slice(0, limit),
    mode: "teaser",
    placeName,
  });

  if (!options.paid || !options.userId) {
    return teaser();
  }

  const profile = await loadMemberProfile(options.userId);
  const home = await loadHomeCoords(profile.homePlaceId);
  const hasSignals =
    profile.interestIds.length > 0 ||
    profile.personaIds.length > 0 ||
    (profile.energyLow != null && profile.energyHigh != null) ||
    (home.lat != null && home.lng != null);

  if (!hasSignals) {
    return teaser(home.name);
  }

  const rows = await loadScoreableListings();
  if (rows.length === 0) {
    return teaser(home.name);
  }

  const scored = rows
    .map((row) => ({
      row,
      score: scoreListing(row, {
        interestIds: new Set(profile.interestIds),
        personaIds: new Set(profile.personaIds),
        energyLow: profile.energyLow,
        energyHigh: profile.energyHigh,
        homeLat: home.lat,
        homeLng: home.lng,
      }),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name));

  if (scored.length === 0) {
    return teaser(home.name);
  }

  return {
    listings: scored.slice(0, limit).map((item) => mapToListing(item.row)),
    mode: "personalised",
    placeName: home.name,
  };
}
