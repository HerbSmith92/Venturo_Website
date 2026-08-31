import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIES,
  categoryColour,
  categoryLabel,
  formatFromPrice,
  type CategoryId,
} from "@/lib/listings";

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";
const CATEGORY_IDS = new Set(CATEGORIES.map((item) => item.id));

export type GuideCardData = {
  id: string;
  title: string;
  slug: string;
  intro: string | null;
  cover: string;
  itemCount: number;
};

export type GuideRecommendation = {
  listingId: string;
  slug: string;
  name: string;
  area: string;
  category: CategoryId;
  vibe: string;
  image: string;
  fromPrice: number;
  memberFromPrice: number | null;
  editorialNote: string | null;
};

export type PublicGuide = {
  id: string;
  title: string;
  slug: string;
  intro: string | null;
  items: GuideRecommendation[];
};

type MediaRow = {
  public_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
};

type ListingEmbed = {
  id: string;
  name: string;
  slug: string;
  suburb: string | null;
  city: string | null;
  short_description: string | null;
  price_from: number | string | null;
  status: string | null;
  listing_media?: MediaRow[];
  listing_activity_kinds?: {
    is_primary: boolean | null;
    activity_kinds?: { key: string | null } | { key: string | null }[] | null;
  }[];
  price_options?: {
    standard_price: number | string | null;
    member_price: number | string | null;
    is_active: boolean | null;
  }[];
};

type GuideRow = {
  id: string;
  title: string;
  slug: string;
  intro: string | null;
  status?: string;
  publish_at?: string | null;
  expire_at?: string | null;
  curated_guide_items?: {
    sort_order: number | null;
    editorial_note: string | null;
    listing_id: string;
    directory_listings?: ListingEmbed | ListingEmbed[] | null;
  }[];
};

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asListing(embed: ListingEmbed | ListingEmbed[] | null | undefined) {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

function coverUrl(media: MediaRow[] | undefined) {
  const sorted = [...(media ?? [])].sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return sorted.find((item) => item.public_url)?.public_url ?? FALLBACK_IMAGE;
}

function memberFrom(row: ListingEmbed) {
  const fromListed = asNumber(row.price_from) ?? 0;
  const active = (row.price_options ?? []).filter((item) => item.is_active !== false);
  const memberPrices = active
    .map((item) => asNumber(item.member_price))
    .filter((n): n is number => n !== null);
  const memberFromPrice = memberPrices.length ? Math.min(...memberPrices) : null;
  return memberFromPrice !== null && memberFromPrice < fromListed ? memberFromPrice : null;
}

function kindKey(
  entry: NonNullable<ListingEmbed["listing_activity_kinds"]>[number],
): string | null {
  const kind = entry.activity_kinds;
  if (!kind) return null;
  return Array.isArray(kind) ? (kind[0]?.key ?? null) : (kind.key ?? null);
}

function mapRecommendation(
  item: NonNullable<GuideRow["curated_guide_items"]>[number],
): GuideRecommendation | null {
  const listing = asListing(item.directory_listings);
  if (!listing || listing.status !== "approved") return null;
  const vibe = (listing.short_description ?? "").trim().replace(/\s+/g, " ");
  const area = (listing.suburb ?? listing.city ?? "South Africa").replace(/,$/, "").trim();
  const kinds = [...(listing.listing_activity_kinds ?? [])].sort(
    (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
  );
  const rawKey = kinds.map(kindKey).find((key): key is string => Boolean(key));
  const category: CategoryId =
    rawKey && CATEGORY_IDS.has(rawKey as CategoryId) ? (rawKey as CategoryId) : "adventure";

  return {
    listingId: listing.id,
    slug: listing.slug,
    name: listing.name,
    area,
    category,
    vibe: vibe.length > 320 ? `${vibe.slice(0, 317)}…` : vibe,
    image: coverUrl(listing.listing_media),
    fromPrice: asNumber(listing.price_from) ?? 0,
    memberFromPrice: memberFrom(listing),
    editorialNote: item.editorial_note,
  };
}

function sortedItems(row: GuideRow) {
  return [...(row.curated_guide_items ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(mapRecommendation)
    .filter((item): item is GuideRecommendation => Boolean(item));
}

const GUIDE_SELECT = `
  id,
  title,
  slug,
  intro,
  status,
  publish_at,
  expire_at,
  curated_guide_items (
    sort_order,
    editorial_note,
    listing_id,
    directory_listings (
      id,
      name,
      slug,
      suburb,
      city,
      short_description,
      price_from,
      status,
      listing_media ( public_url, is_cover, sort_order ),
      listing_activity_kinds ( is_primary, activity_kinds ( key ) ),
      price_options ( standard_price, member_price, is_active )
    )
  )
`;

function isCurrentlyLive(row: {
  status?: string;
  publish_at?: string | null;
  expire_at?: string | null;
}) {
  if (row.status && row.status !== "published") return false;
  const now = Date.now();
  if (row.publish_at && new Date(row.publish_at).getTime() > now) return false;
  if (row.expire_at && new Date(row.expire_at).getTime() <= now) return false;
  return true;
}

export async function liveGuides(limit?: number): Promise<GuideCardData[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("curated_guides")
    .select(GUIDE_SELECT)
    .eq("status", "published")
    .order("publish_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (limit) query = query.limit(Math.max(limit, 8));

  const { data, error } = await query;
  if (error || !data) return [];

  const cards = (data as GuideRow[])
    .filter(isCurrentlyLive)
    .map((row) => {
      const items = sortedItems(row);
      if (items.length === 0) return null;
      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        intro: row.intro,
        cover: items[0]?.image ?? FALLBACK_IMAGE,
        itemCount: items.length,
      } satisfies GuideCardData;
    })
    .filter((row): row is GuideCardData => Boolean(row));

  return typeof limit === "number" ? cards.slice(0, limit) : cards;
}

export async function getPublicGuideBySlug(slug: string): Promise<PublicGuide | null> {
  const supabase = await createClient();
  if (!supabase || !slug) return null;

  const { data, error } = await supabase
    .from("curated_guides")
    .select(GUIDE_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as GuideRow;
  if (!isCurrentlyLive(row)) return null;
  const items = sortedItems(row);
  if (items.length === 0) return null;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    intro: row.intro,
    items,
  };
}

export { formatFromPrice, categoryColour, categoryLabel };
