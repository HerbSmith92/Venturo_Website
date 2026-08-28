import { createClient } from "@/lib/supabase/server";

export type CategoryId =
  | "adventure"
  | "thrills"
  | "family"
  | "romance"
  | "team"
  | "nightlife"
  | "workshop"
  | "markets"
  | "digital"
  | "third-party";

export type Listing = {
  id: string;
  slug: string;
  name: string;
  area: string;
  city: string;
  category: CategoryId;
  vibe: string;
  energy: "Low" | "Medium" | "High";
  fromPrice: number;
  memberFromPrice: number | null;
  image: string;
  featured: boolean;
};

export const CATEGORIES: {
  id: CategoryId | "all";
  label: string;
  colour: string;
}[] = [
  { id: "all", label: "All", colour: "#EBEBF3" },
  { id: "team", label: "Team", colour: "#F3BF4A" },
  { id: "thrills", label: "Thrills", colour: "#FF9E6B" },
  { id: "adventure", label: "Adventure", colour: "#45A67F" },
  { id: "romance", label: "Romance", colour: "#D54732" },
  { id: "family", label: "Family", colour: "#DC729E" },
  { id: "workshop", label: "Workshop", colour: "#FF2EFF" },
  { id: "markets", label: "Markets", colour: "#971A21" },
  { id: "digital", label: "Digital", colour: "#7CC3E9" },
  { id: "nightlife", label: "Nightlife", colour: "#5E589E" },
  { id: "third-party", label: "Third Party", colour: "#14001A" },
];

const CATEGORY_IDS = new Set(CATEGORIES.map((item) => item.id));

function isCategoryId(value: string): value is CategoryId {
  return CATEGORY_IDS.has(value as CategoryId);
}

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";

type LiveRow = {
  id: string;
  name: string;
  slug: string;
  suburb: string | null;
  city: string | null;
  short_description: string | null;
  price_from: number | string | null;
  is_featured: boolean | null;
  google_rating: number | string | null;
  listing_media?: { public_url: string | null; is_cover: boolean | null; sort_order: number | null }[];
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

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function kindKey(entry: LiveRow["listing_activity_kinds"] extends (infer T)[] | undefined ? T : never) {
  const kind = entry.activity_kinds;
  if (!kind) return null;
  return Array.isArray(kind) ? kind[0]?.key : kind.key;
}

function mapLiveRow(row: LiveRow): Listing {
  const kinds = [...(row.listing_activity_kinds ?? [])].sort((a, b) =>
    Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
  );
  const rawKey = kinds.map(kindKey).find((key): key is string => Boolean(key));
  const category: CategoryId = rawKey && isCategoryId(rawKey) ? rawKey : "adventure";

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
  const area = (row.suburb ?? row.city ?? "Gauteng").replace(/,$/, "").trim();
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

async function loadLiveListings(): Promise<Listing[] | null> {
  const supabase = await createClient();
  if (!supabase) return null;

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
      google_rating,
      listing_media ( public_url, is_cover, sort_order ),
      listing_activity_kinds ( is_primary, activity_kinds ( key ) ),
      price_options ( standard_price, member_price, is_active )
    `,
    )
    .eq("status", "approved")
    .order("name");

  if (error || !data) return null;
  return (data as LiveRow[]).map(mapLiveRow);
}

export async function featuredListings() {
  const listings = (await loadLiveListings()) ?? [];
  const marked = listings.filter((listing) => listing.featured);
  if (marked.length) return marked.slice(0, 8);
  return listings.filter((listing) => listing.image !== FALLBACK_IMAGE).slice(0, 8);
}

export async function listingsByCategory(category?: string) {
  const listings = (await loadLiveListings()) ?? [];
  if (!category || category === "all") return listings;
  return listings.filter((listing) => listing.category === category);
}

export function formatFromPrice(rand: number) {
  if (rand === 0) return "Free";
  return `From R ${rand.toFixed(2)}`;
}

export function hasMemberDiscount(listing: Listing) {
  return listing.memberFromPrice !== null && listing.memberFromPrice < listing.fromPrice;
}

export function categoryLabel(id: CategoryId) {
  return CATEGORIES.find((item) => item.id === id)?.label ?? id;
}

export function categoryColour(id: CategoryId) {
  return CATEGORIES.find((item) => item.id === id)?.colour ?? "#FF9E6B";
}
