import { createClient } from "@/lib/supabase/server";
import {
  isGuideStatus,
  type GuideDraftItem,
  type GuideListingPreview,
  type GuideStatus,
} from "@/lib/guide-shared";

export type GuideQueueRow = {
  id: string;
  title: string;
  slug: string;
  status: GuideStatus;
  publish_at: string | null;
  expire_at: string | null;
  updated_at: string;
  item_count: number;
};

export type GuideEditorRecord = {
  id: string;
  title: string;
  slug: string;
  intro: string | null;
  status: GuideStatus;
  publish_at: string | null;
  expire_at: string | null;
  interest_ids: string[];
  items: GuideDraftItem[];
};

type MediaRow = {
  public_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
};

type KindRow = {
  is_primary?: boolean | null;
  activity_kinds?:
    | { key: string | null; title: string | null }
    | { key: string | null; title: string | null }[]
    | null;
};

type ListingRow = {
  id: string;
  name: string;
  slug: string;
  suburb: string | null;
  city: string | null;
  street_address_1?: string | null;
  street_address_2?: string | null;
  postal_code?: string | null;
  short_description: string | null;
  price_from: number | string | null;
  status: string;
  indoor_outdoor?: string | null;
  booking_required?: boolean | null;
  listing_media?: MediaRow[];
  listing_activity_kinds?: KindRow[];
};

const LISTING_SELECT = `
  id, name, slug, suburb, city, street_address_1, street_address_2, postal_code,
  short_description, price_from, status,
  indoor_outdoor, booking_required,
  listing_media ( public_url, is_cover, sort_order ),
  listing_activity_kinds ( is_primary, activity_kinds ( key, title ) )
`;

function coverFromMedia(media: MediaRow[] | undefined) {
  const sorted = [...(media ?? [])].sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return sorted.find((item) => item.public_url)?.public_url ?? null;
}

function primaryKind(kinds: KindRow[] | undefined) {
  const sorted = [...(kinds ?? [])].sort(
    (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
  );
  for (const entry of sorted) {
    const kind = entry.activity_kinds;
    const row = Array.isArray(kind) ? kind[0] : kind;
    if (row?.key || row?.title) {
      return {
        key: row.key ?? null,
        title: row.title ?? null,
      };
    }
  }
  return { key: null, title: null };
}

function asIndoorOutdoor(value: string | null | undefined): GuideListingPreview["indoor_outdoor"] {
  if (value === "indoor" || value === "outdoor" || value === "both") return value;
  return null;
}

function mapListingPreview(row: ListingRow): GuideListingPreview {
  const kind = primaryKind(row.listing_activity_kinds);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    suburb: row.suburb,
    city: row.city,
    street_address_1: row.street_address_1 ?? null,
    street_address_2: row.street_address_2 ?? null,
    postal_code: row.postal_code ?? null,
    short_description: row.short_description,
    price_from: row.price_from,
    status: row.status,
    image: coverFromMedia(row.listing_media),
    indoor_outdoor: asIndoorOutdoor(row.indoor_outdoor),
    booking_required: Boolean(row.booking_required),
    activity_kind_key: kind.key,
    activity_kind_title: kind.title,
  };
}

export async function loadGuideQueue(status?: string): Promise<GuideQueueRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("curated_guides")
    .select(
      `
      id, title, slug, status, publish_at, expire_at, updated_at,
      curated_guide_items ( id )
    `,
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status && isGuideStatus(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as {
    id: string;
    title: string;
    slug: string;
    status: GuideStatus;
    publish_at: string | null;
    expire_at: string | null;
    updated_at: string;
    curated_guide_items?: { id: string }[];
  }[]).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    publish_at: row.publish_at,
    expire_at: row.expire_at,
    updated_at: row.updated_at,
    item_count: row.curated_guide_items?.length ?? 0,
  }));
}

export async function loadGuideEditor(id: string): Promise<GuideEditorRecord | null> {
  const supabase = await createClient();
  if (!supabase || !id) return null;

  const { data, error } = await supabase
    .from("curated_guides")
    .select(
      `
      id, title, slug, intro, status, publish_at, expire_at,
      curated_guide_interests ( interest_id ),
      curated_guide_items (
        listing_id, sort_order, editorial_note,
        directory_listings ( ${LISTING_SELECT} )
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  type ItemRow = {
    listing_id: string;
    sort_order: number | null;
    editorial_note: string | null;
    directory_listings?: ListingRow | ListingRow[] | null;
  };

  const row = data as {
    id: string;
    title: string;
    slug: string;
    intro: string | null;
    status: GuideStatus;
    publish_at: string | null;
    expire_at: string | null;
    curated_guide_interests?: { interest_id: string }[];
    curated_guide_items?: ItemRow[];
  };

  const items = [...(row.curated_guide_items ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => {
      const listing = Array.isArray(item.directory_listings)
        ? item.directory_listings[0]
        : item.directory_listings;
      return {
        listing_id: item.listing_id,
        editorial_note: item.editorial_note ?? "",
        listing: listing ? mapListingPreview(listing) : null,
      };
    });

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    intro: row.intro,
    status: row.status,
    publish_at: row.publish_at,
    expire_at: row.expire_at,
    interest_ids: (row.curated_guide_interests ?? []).map((item) => item.interest_id),
    items,
  };
}

export async function searchGuideListings(
  q: string,
  interestIds: string[] = [],
): Promise<GuideListingPreview[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const interests = interestIds.slice(0, 12);
  const name = q.trim();

  if (interests.length) {
    let query = supabase
      .from("directory_listings")
      .select(
        `
        ${LISTING_SELECT},
        listing_interests!inner ( interest_id )
      `,
      )
      .eq("status", "approved")
      .in("listing_interests.interest_id", interests)
      .order("updated_at", { ascending: false })
      .limit(24);
    if (name) query = query.ilike("name", `%${name}%`);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as unknown as ListingRow[]).map(mapListingPreview);
  }

  let query = supabase
    .from("directory_listings")
    .select(LISTING_SELECT)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(24);
  if (name) query = query.ilike("name", `%${name}%`);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as ListingRow[]).map(mapListingPreview);
}
