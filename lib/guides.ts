import { cache } from "react";
import { unstable_cache } from "next/cache";
import { PUBLIC_CATALOG_TAG } from "@/lib/public-cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";
import { liveEventGuides } from "@/lib/event-guides";
import { authorFromEmbed, type GuideAuthor, type GuideAuthorPublic } from "@/lib/guide-authors";
import {
  CATEGORIES,
  categoryColour,
  categoryLabel,
  formatFromPrice,
  type CategoryId,
} from "@/lib/listings";
import {
  coverPhoto,
  emptySpotlightCover,
  parseSpotlightCover,
  parseSpotlightPhotos,
  parseSpotlightStory,
  type SpotlightCover,
  type SpotlightPhoto,
  type SpotlightSection,
} from "@/lib/spotlight";

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";
const CATEGORY_IDS = new Set(CATEGORIES.map((item) => item.id));

export type GuideCardData = {
  id: string;
  title: string;
  slug: string;
  intro: string | null;
  cover: string;
  itemCount: number;
  about?: "activities" | "events";
  shape?: "roundup" | "spotlight";
  authorName?: string | null;
  authorId?: string | null;
  authorSlug?: string | null;
  publishAt?: string | null;
  viewCount?: number;
  likeCount?: number;
};

export type GuideRecommendation = {
  listingId: string;
  slug: string;
  name: string;
  area: string;
  category: CategoryId;
  vibe: string;
  image: string;
  fromPrice: number | null;
  memberFromPrice: number | null;
  editorialNote: string | null;
};

export type PublicGuide = {
  id: string;
  title: string;
  slug: string;
  intro: string | null;
  body: string | null;
  shape: "roundup" | "spotlight";
  author: GuideAuthorPublic | null;
  items: GuideRecommendation[];
  listingId: string | null;
  story: SpotlightSection[];
  photos: SpotlightPhoto[];
  cover: SpotlightCover;
  publishedAt: string | null;
  updatedAt: string | null;
  viewCount: number;
  likeCount: number;
};

type MediaRow = {
  public_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
  is_pending?: boolean | null;
};

type ListingEmbed = {
  id: string;
  name: string;
  slug: string;
  suburb: string | null;
  city: string | null;
  short_description: string | null;
  description: string | null;
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
  body?: string | null;
  shape?: "roundup" | "spotlight" | null;
  status?: string;
  publish_at?: string | null;
  expire_at?: string | null;
  listing_id?: string | null;
  story?: unknown;
  photos?: unknown;
  cover?: unknown;
  published_snapshot?: Record<string, unknown> | null;
  updated_at?: string | null;
  view_count?: number | null;
  like_count?: number | null;
  guide_authors?: GuideAuthor | GuideAuthor[] | null;
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
  const sorted = [...(media ?? [])].filter((item) => !item.is_pending).sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return sorted.find((item) => item.public_url)?.public_url ?? FALLBACK_IMAGE;
}

function memberFrom(row: ListingEmbed) {
  const fromListed = asNumber(row.price_from);
  const active = (row.price_options ?? []).filter((item) => item.is_active !== false);
  const memberPrices = active
    .map((item) => asNumber(item.member_price))
    .filter((n): n is number => n !== null);
  const memberFromPrice = memberPrices.length ? Math.min(...memberPrices) : null;
  return memberFromPrice !== null && fromListed != null && memberFromPrice < fromListed
    ? memberFromPrice
    : null;
}

function listingBlurb(description: string | null | undefined, shortDescription: string | null | undefined) {
  const source = (description || shortDescription || "").trim().replace(/\s+/g, " ");
  if (!source) return "";
  const sentences = source.match(/[^.!?]+[.!?]+(?:["”']*)/g);
  if (!sentences?.length) {
    const cut = source.lastIndexOf(" ", 360);
    return source.length > 360 ? `${source.slice(0, cut > 180 ? cut : 360).trimEnd()}…` : source;
  }
  let out = sentences[0].trim();
  const second = sentences[1]?.trim();
  if (second && `${out} ${second}`.length <= 480) out = `${out} ${second}`;
  return out;
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
  const vibe = listingBlurb(listing.description, listing.short_description);
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
    vibe,
    image: coverUrl(listing.listing_media),
    fromPrice: asNumber(listing.price_from),
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

const GUIDE_ITEMS_SELECT = `
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
      description,
      price_from,
      status,
      listing_media ( public_url, is_cover, sort_order, is_pending ),
      listing_activity_kinds ( is_primary, activity_kinds ( key ) ),
      price_options ( standard_price, member_price, is_active )
    )
  )
`;

const GUIDE_SELECT = `
  id, title, slug, intro, body, shape, status, publish_at, expire_at, listing_id, story, photos, cover, published_snapshot, updated_at, view_count, like_count,
  guide_authors ( id, display_name, slug, tagline, bio, photo_url, photo_storage_key, cover_url, cover_storage_key, instagram_url, tiktok_url, facebook_url, website_url, user_id ),
  ${GUIDE_ITEMS_SELECT}
`;

const GUIDE_SELECT_LEGACY = `
  id, title, slug, intro, status, publish_at, expire_at,
  ${GUIDE_ITEMS_SELECT}
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

async function fetchLiveGuides(limit?: number): Promise<GuideCardData[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];

  let query = supabase
    .from("curated_guides")
    .select(GUIDE_SELECT)
    .eq("status", "published")
    .order("publish_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (limit) query = query.limit(Math.max(limit, 8));

  let { data, error } = await query;
  if (error) {
    let fallback = supabase
      .from("curated_guides")
      .select(GUIDE_SELECT_LEGACY)
      .eq("status", "published")
      .order("publish_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });
    if (limit) fallback = fallback.limit(Math.max(limit, 8));
    const retry = await fallback;
    data = retry.data as typeof data;
    error = retry.error;
  }
  if (error || !data) return [];

  const cards: GuideCardData[] = (data as GuideRow[]).flatMap((row) => {
    if (!isCurrentlyLive(row)) return [];
    const items = sortedItems(row);
    if (items.length === 0) return [];
    const author = authorFromEmbed(row.guide_authors);
    const snapshot = row.published_snapshot;
    const photos = parseSpotlightPhotos(snapshot?.photos ?? row.photos);
    const cover = parseSpotlightCover(snapshot?.cover ?? row.cover);
    const spotlightCover = coverPhoto(photos, cover)?.url;
    return [
      {
        id: row.id,
        title: (typeof snapshot?.title === "string" ? snapshot.title : row.title),
        slug: row.slug,
        intro: (typeof snapshot?.intro === "string" ? snapshot.intro : row.intro),
        cover: spotlightCover ?? items[0]?.image ?? FALLBACK_IMAGE,
        itemCount: items.length,
        about: "activities",
        shape: row.shape === "spotlight" ? "spotlight" : "roundup",
        authorName: author?.name ?? null,
        authorId: author?.id ?? null,
        authorSlug: author?.slug ?? null,
        publishAt: row.publish_at ?? null,
        viewCount: row.view_count ?? 0,
        likeCount: row.like_count ?? 0,
      },
    ];
  });

  const events = await liveEventGuides(typeof limit === "number" ? Math.max(limit, 8) : 48);
  const merged: GuideCardData[] = [...cards, ...events].sort((a, b) => {
    const aTime = a.publishAt ? Date.parse(a.publishAt) : 0;
    const bTime = b.publishAt ? Date.parse(b.publishAt) : 0;
    return bTime - aTime;
  });

  return typeof limit === "number" ? merged.slice(0, limit) : merged;
}

const cachedLiveGuides = unstable_cache(
  async (limit: number) => fetchLiveGuides(limit === 0 ? undefined : limit),
  ["live-guides"],
  { revalidate: 60, tags: [PUBLIC_CATALOG_TAG] },
);

export const liveGuides = cache(async (limit?: number) => cachedLiveGuides(limit ?? 0));

export async function liveGuidesByAuthor(authorId: string): Promise<GuideCardData[]> {
  if (!authorId) return [];
  return (await liveGuides()).filter((guide) => guide.authorId === authorId);
}

export async function getPublicGuideBySlug(slug: string): Promise<PublicGuide | null> {
  const supabase = await createClient();
  if (!supabase || !slug) return null;

  let { data, error } = await supabase
    .from("curated_guides")
    .select(GUIDE_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    const retry = await supabase
      .from("curated_guides")
      .select(GUIDE_SELECT_LEGACY)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error || !data) return null;
  const row = data as GuideRow;
  if (!isCurrentlyLive(row)) return null;
  const items = sortedItems(row);
  if (items.length === 0) return null;
  const snapshot = row.published_snapshot;
  const title = typeof snapshot?.title === "string" ? snapshot.title : row.title;
  const intro = typeof snapshot?.intro === "string" ? snapshot.intro : row.intro;
  const story = parseSpotlightStory(snapshot?.story ?? row.story);
  const photos = parseSpotlightPhotos(snapshot?.photos ?? row.photos);
  const cover = parseSpotlightCover(snapshot?.cover ?? row.cover) ?? emptySpotlightCover();
  const listingId =
    (typeof snapshot?.listing_id === "string" ? snapshot.listing_id : null) ?? row.listing_id ?? items[0]?.listingId ?? null;

  return {
    id: row.id,
    title,
    slug: row.slug,
    intro,
    body: row.body ?? null,
    shape: row.shape === "spotlight" ? "spotlight" : "roundup",
    author: authorFromEmbed(row.guide_authors),
    items,
    listingId,
    story,
    photos,
    cover,
    publishedAt: row.publish_at ?? row.updated_at ?? null,
    updatedAt: row.updated_at ?? null,
    viewCount: row.view_count ?? 0,
    likeCount: row.like_count ?? 0,
  };
}

export { formatFromPrice, categoryColour, categoryLabel };

export async function listGuideEventIds(guideId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("curated_guide_events")
    .select("event_id, sort_order")
    .eq("guide_id", guideId)
    .order("sort_order");
  if (error || !data) return [];
  return data.map((row) => row.event_id as string);
}
