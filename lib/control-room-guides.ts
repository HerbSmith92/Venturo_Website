import { createClient } from "@/lib/supabase/server";
import {
  isGuideStatus,
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
  items: {
    listing_id: string;
    editorial_note: string;
    listing: GuideListingPreview | null;
  }[];
};

type MediaRow = {
  public_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
};

function coverFromMedia(media: MediaRow[] | undefined) {
  const sorted = [...(media ?? [])].sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return sorted.find((item) => item.public_url)?.public_url ?? null;
}

function mapListingPreview(row: {
  id: string;
  name: string;
  slug: string;
  suburb: string | null;
  city: string | null;
  short_description: string | null;
  price_from: number | string | null;
  status: string;
  listing_media?: MediaRow[];
}): GuideListingPreview {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    suburb: row.suburb,
    city: row.city,
    short_description: row.short_description,
    price_from: row.price_from,
    status: row.status,
    image: coverFromMedia(row.listing_media),
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
        directory_listings (
          id, name, slug, suburb, city, short_description, price_from, status,
          listing_media ( public_url, is_cover, sort_order )
        )
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
    directory_listings?:
      | {
          id: string;
          name: string;
          slug: string;
          suburb: string | null;
          city: string | null;
          short_description: string | null;
          price_from: number | string | null;
          status: string;
          listing_media?: MediaRow[];
        }
      | {
          id: string;
          name: string;
          slug: string;
          suburb: string | null;
          city: string | null;
          short_description: string | null;
          price_from: number | string | null;
          status: string;
          listing_media?: MediaRow[];
        }[]
      | null;
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
  const listingFields = `
      id, name, slug, suburb, city, short_description, price_from, status,
      listing_media ( public_url, is_cover, sort_order )
    `;
  const select = interests.length
    ? `${listingFields}, listing_interests!inner ( interest_id )`
    : listingFields;

  let query = supabase
    .from("directory_listings")
    .select(select)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(24);

  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  if (interests.length) {
    query = query.in("listing_interests.interest_id", interests);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Parameters<typeof mapListingPreview>[0][]).map(mapListingPreview);
}
