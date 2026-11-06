import { canManageGuide, type GuideViewer } from "@/lib/guide-access";
import { createClient } from "@/lib/supabase/server";
import {
  GUIDE_FILL_LIMIT,
  GUIDE_NEAR_KM,
  guideFromPrice,
  guideHasAudience,
  isGuideStatus,
  listingMatchesGuideAudience,
  pickGuideFillListings,
  type GuideAudienceMatch,
  type GuideDraftItem,
  type GuideListingPreview,
  type GuidePlace,
  type GuideStatus,
} from "@/lib/guide-shared";
import {
  emptySpotlightCover,
  parseSpotlightCover,
  parseSpotlightPhotos,
  parseSpotlightStory,
  type SpotlightCover,
  type SpotlightListingMedia,
  type SpotlightPhoto,
  type SpotlightSection,
} from "@/lib/spotlight";

export type GuideQueueRow = {
  id: string;
  title: string;
  slug: string;
  status: GuideStatus;
  publish_at: string | null;
  expire_at: string | null;
  updated_at: string;
  item_count: number;
  about: "activities" | "events";
  shape: string;
  author_name: string | null;
  author_photo: string | null;
  cover: string | null;
  created_by: string;
};

export type GuideEditorRecord = {
  id: string;
  title: string;
  slug: string;
  intro: string | null;
  body: string | null;
  shape: "roundup" | "spotlight";
  author_id: string | null;
  status: GuideStatus;
  publish_at: string | null;
  expire_at: string | null;
  kind_ids: string[];
  persona_ids: string[];
  scale_id: string | null;
  interest_ids: string[];
  place_ids: string[];
  items: GuideDraftItem[];
  created_by: string;
  listing_id: string | null;
  story: SpotlightSection[];
  photos: SpotlightPhoto[];
  cover: SpotlightCover;
  carousel_draft: unknown;
  updated_at: string | null;
};

export type SpotlightListingDetails = {
  id: string;
  name: string;
  slug: string;
  area: string;
  fromPrice: number | string | null;
  bookingUrl: string | null;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  bookingRequired: boolean;
  indoorOutdoor: string | null;
  activityKindKey: string | null;
  hours: { dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }[];
  media: SpotlightListingMedia[];
};

type MediaRow = {
  public_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
  is_pending?: boolean | null;
};

type KindRow = {
  activity_kind_id?: string | null;
  is_primary?: boolean | null;
  activity_kinds?:
    | { id?: string | null; key: string | null; title: string | null }
    | { id?: string | null; key: string | null; title: string | null }[]
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
  latitude?: number | string | null;
  longitude?: number | string | null;
  status: string;
  indoor_outdoor?: string | null;
  booking_required?: boolean | null;
  listing_media?: MediaRow[];
  listing_activity_kinds?: KindRow[];
};

const LISTING_SELECT = `
  id, name, slug, suburb, city, street_address_1, street_address_2, postal_code,
  short_description, price_from, latitude, longitude, status,
  indoor_outdoor, booking_required,
  listing_media!listing_media_listing_id_fkey ( public_url, is_cover, sort_order, is_pending ),
  listing_activity_kinds ( activity_kind_id, is_primary, activity_kinds ( id, key, title ) )
`;

function coverFromMedia(media: MediaRow[] | undefined) {
  const sorted = [...(media ?? [])].filter((item) => !item.is_pending).sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return sorted.find((item) => item.public_url)?.public_url ?? null;
}

function primaryKind(kinds: KindRow[] | undefined) {
  const rows = [...(kinds ?? [])];
  const primary = rows.filter((entry) => entry.is_primary === true);
  const sorted = primary.length ? [...primary, ...rows.filter((entry) => entry.is_primary !== true)] : rows;
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

function authorFromQueue(raw: { display_name?: string | null; photo_url?: string | null } | { display_name?: string | null; photo_url?: string | null }[] | null | undefined) {
  const author = Array.isArray(raw) ? raw[0] : raw;
  return {
    author_name: author?.display_name ?? null,
    author_photo: author?.photo_url ?? null,
  };
}

function coverFromGuideItems(
  items:
    | {
        sort_order?: number | null;
        directory_listings?: ListingRow | ListingRow[] | null;
      }[]
    | undefined,
) {
  const sorted = [...(items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  for (const item of sorted) {
    const listing = Array.isArray(item.directory_listings) ? item.directory_listings[0] : item.directory_listings;
    const cover = coverFromMedia(listing?.listing_media);
    if (cover) return cover;
  }
  return null;
}

function mapListingPreview(row: ListingRow): GuideListingPreview {
  const kind = primaryKind(row.listing_activity_kinds);
  const images = [...(row.listing_media ?? [])]
    .filter((item) => !item.is_pending && item.public_url)
    .sort((a, b) => {
      if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    })
    .map((item) => item.public_url as string);
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
    image: images[0] ?? coverFromMedia(row.listing_media),
    images,
    indoor_outdoor: asIndoorOutdoor(row.indoor_outdoor),
    booking_required: Boolean(row.booking_required),
    activity_kind_key: kind.key,
    activity_kind_title: kind.title,
  };
}

export async function loadGuideQueue(
  status?: string,
  viewer?: GuideViewer,
): Promise<GuideQueueRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("curated_guides")
    .select(
      `
      id, title, slug, status, publish_at, expire_at, updated_at, shape, created_by, author_id,
      curated_guide_items ( id, sort_order, directory_listings ( listing_media ( public_url, is_cover, sort_order, is_pending ) ) ),
      guide_authors ( display_name, photo_url )
    `,
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status && isGuideStatus(status)) query = query.eq("status", status);

  let { data, error } = await query;
  if (error) {
    let fallback = supabase
      .from("curated_guides")
      .select(
        `
      id, title, slug, status, publish_at, expire_at, updated_at, created_by, author_id,
      curated_guide_items ( id )
    `,
      )
      .order("updated_at", { ascending: false })
      .limit(200);
    if (status && isGuideStatus(status)) fallback = fallback.eq("status", status);
    const retry = await fallback;
    data = retry.data as typeof data;
    error = retry.error;
  }
  if (error || !data) return [];

  return (
    data as {
      id: string;
      title: string;
      slug: string;
      status: GuideStatus;
      publish_at: string | null;
      expire_at: string | null;
      updated_at: string;
      shape?: string | null;
      created_by?: string;
      author_id?: string | null;
      curated_guide_items?: {
        id?: string;
        sort_order?: number | null;
        directory_listings?: ListingRow | ListingRow[] | null;
      }[];
      guide_authors?: { display_name: string; photo_url?: string | null } | { display_name: string; photo_url?: string | null }[] | null;
    }[]
  )
    .filter((row) => canManageGuide(row, viewer))
    .map((row) => {
      const author = authorFromQueue(row.guide_authors);
      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status,
        publish_at: row.publish_at,
        expire_at: row.expire_at,
        updated_at: row.updated_at,
        item_count: row.curated_guide_items?.length ?? 0,
        about: "activities" as const,
        shape: row.shape || "roundup",
        author_name: author.author_name,
        author_photo: author.author_photo,
        cover: coverFromGuideItems(row.curated_guide_items),
        created_by: row.created_by ?? "",
      };
    });
}

export async function loadGuideEditor(id: string): Promise<GuideEditorRecord | null> {
  const supabase = await createClient();
  if (!supabase || !id) return null;

  let { data, error } = await supabase
    .from("curated_guides")
    .select(
      `
      id, title, slug, intro, body, shape, author_id, status, publish_at, expire_at, scale_id, created_by,
      listing_id, story, photos, cover, carousel_draft, updated_at, place_ids,
      curated_guide_interests ( interest_id ),
      curated_guide_activity_kinds ( activity_kind_id ),
      curated_guide_personas ( persona_id ),
      curated_guide_items (
        listing_id, sort_order, editorial_note,
        directory_listings ( ${LISTING_SELECT} )
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    const retry = await supabase
      .from("curated_guides")
      .select(
        `
      id, title, slug, intro, status, publish_at, expire_at, scale_id,
      curated_guide_interests ( interest_id ),
      curated_guide_activity_kinds ( activity_kind_id ),
      curated_guide_personas ( persona_id ),
      curated_guide_items (
        listing_id, sort_order, editorial_note,
        directory_listings ( ${LISTING_SELECT} )
      )
    `,
      )
      .eq("id", id)
      .maybeSingle();
    if (retry.error || !retry.data) return null;
    data = retry.data as typeof data;
  }
  if (!data) return null;

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
    body?: string | null;
    shape?: "roundup" | "spotlight" | null;
    author_id?: string | null;
    status: GuideStatus;
    publish_at: string | null;
    expire_at: string | null;
    scale_id: string | null;
    created_by?: string;
    listing_id?: string | null;
    story?: unknown;
    photos?: unknown;
    cover?: unknown;
    carousel_draft?: unknown;
    updated_at?: string | null;
    place_ids?: string[] | null;
    curated_guide_interests?: { interest_id: string }[];
    curated_guide_activity_kinds?: { activity_kind_id: string }[];
    curated_guide_personas?: { persona_id: string }[];
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
    body: row.body ?? null,
    shape: row.shape === "spotlight" ? "spotlight" : "roundup",
    author_id: row.author_id ?? null,
    status: row.status,
    publish_at: row.publish_at,
    expire_at: row.expire_at,
    scale_id: row.scale_id,
    kind_ids: (row.curated_guide_activity_kinds ?? []).map((item) => item.activity_kind_id),
    persona_ids: (row.curated_guide_personas ?? []).map((item) => item.persona_id),
    interest_ids: (row.curated_guide_interests ?? []).map((item) => item.interest_id),
    place_ids: Array.isArray(row.place_ids) ? row.place_ids.filter(Boolean) : [],
    items,
    created_by: row.created_by ?? "",
    listing_id: row.listing_id ?? items[0]?.listing_id ?? null,
    story: parseSpotlightStory(row.story),
    photos: parseSpotlightPhotos(row.photos),
    cover: parseSpotlightCover(row.cover) ?? emptySpotlightCover(),
    carousel_draft: row.carousel_draft ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function loadSpotlightListingDetails(listingId: string): Promise<SpotlightListingDetails | null> {
  const supabase = await createClient();
  if (!supabase || !listingId) return null;
  const { data, error } = await supabase
    .from("directory_listings")
    .select(
      `
      id, name, slug, suburb, city, price_from, booking_url, website_url, phone, email,
      booking_required, indoor_outdoor,
      listing_media ( id, public_url, is_cover, sort_order, alt_text, is_pending ),
      listing_activity_kinds ( is_primary, activity_kinds ( key, title ) ),
      operating_hours ( day_of_week, opens_at, closes_at, is_closed )
    `,
    )
    .eq("id", listingId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    name: string;
    slug: string;
    suburb: string | null;
    city: string | null;
    price_from: number | string | null;
    booking_url: string | null;
    website_url: string | null;
    phone: string | null;
    email: string | null;
    booking_required: boolean | null;
    indoor_outdoor: string | null;
    listing_activity_kinds?: KindRow[];
    listing_media?: {
      id: string;
      public_url: string | null;
      is_cover: boolean | null;
      sort_order: number | null;
      alt_text: string | null;
      is_pending?: boolean | null;
    }[];
    operating_hours?: {
      day_of_week: number;
      opens_at: string | null;
      closes_at: string | null;
      is_closed: boolean;
    }[];
  };
  const media = [...(row.listing_media ?? [])]
    .filter((item) => !item.is_pending && item.public_url)
    .sort((a, b) => {
      if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    })
    .map((item) => ({
      id: item.id,
      url: item.public_url as string,
      alt: item.alt_text,
      isCover: Boolean(item.is_cover),
    }));
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    area: [row.suburb, row.city].filter(Boolean).join(", ").replace(/,\s*,+/g, ",").replace(/,\s*$/, "") || "South Africa",
    fromPrice: row.price_from,
    bookingUrl: row.booking_url,
    websiteUrl: row.website_url,
    phone: row.phone,
    email: row.email,
    bookingRequired: Boolean(row.booking_required),
    indoorOutdoor: row.indoor_outdoor,
    activityKindKey: primaryKind(row.listing_activity_kinds).key,
    hours: [...(row.operating_hours ?? [])]
      .sort((a, b) => a.day_of_week - b.day_of_week)
      .map((hour) => ({
        dayOfWeek: hour.day_of_week,
        opensAt: hour.opens_at,
        closesAt: hour.closes_at,
        isClosed: Boolean(hour.is_closed),
      })),
    media,
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

export async function loadGuidePlaces(): Promise<GuidePlace[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("places")
    .select("id, name, lat, lng, region")
    .eq("is_active", true)
    .order("name");
  if (error || !data) return [];

  return (data as {
    id: string;
    name: string | null;
    lat: number | string | null;
    lng: number | string | null;
    region: string | null;
  }[]).flatMap((row) => {
    const name = row.name?.trim();
    if (!row.id || !name) return [];
    const lat = row.lat == null || row.lat === "" ? null : Number(row.lat);
    const lng = row.lng == null || row.lng === "" ? null : Number(row.lng);
    return [
      {
        id: row.id,
        name,
        lat: lat != null && Number.isFinite(lat) ? lat : null,
        lng: lng != null && Number.isFinite(lng) ? lng : null,
        region: row.region?.trim() || "",
      },
    ];
  });
}

function relationIds(rows: object[] | null | undefined, key: string) {
  const ids: string[] = [];
  for (const row of rows ?? []) {
    const value = (row as Record<string, unknown>)[key];
    if (typeof value === "string" && value && !ids.includes(value)) ids.push(value);
  }
  return ids;
}

function listingKindIds(rows: KindRow[] | null | undefined) {
  const ids = relationIds(rows as object[] | undefined, "activity_kind_id");
  for (const row of rows ?? []) {
    const nested = Array.isArray(row.activity_kinds) ? row.activity_kinds[0] : row.activity_kinds;
    const id = nested?.id;
    if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function listingIdsIn(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  table: string,
  column: string,
  values: string[],
) {
  if (!values.length) return { ids: [] as string[] };
  const { data, error } = await supabase.from(table).select("listing_id").in(column, values);
  if (error) return { error: error.message, ids: [] as string[] };
  const ids: string[] = [];
  for (const row of data ?? []) {
    const id = (row as { listing_id?: string | null }).listing_id;
    if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  }
  return { ids };
}

function intersectIds(groups: string[][]) {
  return groups.reduce((current, next) => current.filter((id) => next.includes(id)));
}

export async function searchGuideFillListings(input: {
  maxPrice?: number | null;
  lat?: number | null;
  lng?: number | null;
  placeNames?: string[];
  audience?: GuideAudienceMatch;
}): Promise<{ listings: GuideListingPreview[]; total: number; error?: string }> {
  const supabase = await createClient();
  const maxPrice =
    input.maxPrice != null && Number.isFinite(input.maxPrice) && input.maxPrice > 0
      ? input.maxPrice
      : null;
  const placeNames = (input.placeNames ?? []).map((item) => item.trim()).filter(Boolean);
  const hasPlace = placeNames.length > 0 || (input.lat != null && input.lng != null);
  const audience = input.audience ?? {};
  if (!supabase || (!maxPrice && !hasPlace && !guideHasAudience(audience))) {
    return { listings: [], total: 0 };
  }

  const kindIds = (audience.kindIds ?? []).filter(Boolean);
  const personaIds = (audience.personaIds ?? []).filter(Boolean);
  const interestIds = (audience.interestIds ?? []).filter(Boolean);
  const scaleId = audience.scaleId?.trim() ?? "";
  let kindInterestIds = (audience.kindInterestIds ?? []).filter(Boolean);

  if (kindIds.length && !kindInterestIds.length) {
    const { data, error } = await supabase.from("interests").select("id").in("activity_kind_id", kindIds);
    if (error) return { listings: [], total: 0, error: "Those listings could not be loaded." };
    kindInterestIds = (data ?? [])
      .map((row) => (row as { id?: string }).id)
      .filter((id): id is string => Boolean(id));
  }

  const groups: string[][] = [];
  if (kindIds.length) {
    const tagged = await listingIdsIn(supabase, "listing_activity_kinds", "activity_kind_id", kindIds);
    const viaInterests = kindInterestIds.length
      ? await listingIdsIn(supabase, "listing_interests", "interest_id", kindInterestIds)
      : { ids: [] as string[] };
    if (tagged.error || viaInterests.error) {
      return { listings: [], total: 0, error: "Those listings could not be loaded." };
    }
    groups.push([...new Set([...tagged.ids, ...viaInterests.ids])]);
  }
  if (personaIds.length) {
    const tagged = await listingIdsIn(supabase, "listing_personas", "persona_id", personaIds);
    if (tagged.error) return { listings: [], total: 0, error: "Those listings could not be loaded." };
    groups.push(tagged.ids);
  }
  if (scaleId) {
    const tagged = await listingIdsIn(supabase, "listing_activity_scales", "activity_scale_id", [scaleId]);
    if (tagged.error) return { listings: [], total: 0, error: "Those listings could not be loaded." };
    groups.push(tagged.ids);
  }
  if (interestIds.length) {
    const tagged = await listingIdsIn(supabase, "listing_interests", "interest_id", interestIds);
    if (tagged.error) return { listings: [], total: 0, error: "Those listings could not be loaded." };
    groups.push(tagged.ids);
  }

  let query = supabase
    .from("directory_listings")
    .select(
      `
      ${LISTING_SELECT},
      listing_activities!listing_activities_listing_id_fkey ( id, cost_varied, status ),
      price_options!price_options_listing_id_fkey ( standard_price, is_active, show_on_from, listing_activity_id ),
      listing_personas ( persona_id ),
      listing_activity_scales ( activity_scale_id ),
      listing_interests ( interest_id )
    `,
    )
    .eq("status", "approved")
    .eq("is_suspended", false)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (groups.length) {
    const matchedIds = intersectIds(groups);
    if (!matchedIds.length) return { listings: [], total: 0 };
    query = query.in("id", matchedIds);
  }

  let { data, error } = await query;
  if (error && /is_suspended/.test(error.message)) {
    query = supabase
      .from("directory_listings")
      .select(
        `
      ${LISTING_SELECT},
      listing_activities!listing_activities_listing_id_fkey ( id, cost_varied, status ),
      price_options!price_options_listing_id_fkey ( standard_price, is_active, show_on_from, listing_activity_id ),
      listing_personas ( persona_id ),
      listing_activity_scales ( activity_scale_id ),
      listing_interests ( interest_id )
    `,
      )
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (groups.length) query = query.in("id", intersectIds(groups));
    const retry = await query;
    data = retry.data;
    error = retry.error;
  }
  if (error || !data) {
    return { listings: [], total: 0, error: "Those listings could not be loaded." };
  }

  const matchAudience: GuideAudienceMatch = {
    ...audience,
    kindInterestIds,
  };
  const matched = (
    data as unknown as (ListingRow & {
      price_options?: Parameters<typeof guideFromPrice>[0];
      listing_activities?: Parameters<typeof guideFromPrice>[1];
      listing_personas?: { persona_id: string | null }[];
      listing_activity_scales?: { activity_scale_id: string | null }[];
      listing_interests?: { interest_id: string | null }[];
    })[]
  )
    .map((row) => ({
      ...row,
      price_from: guideFromPrice(row.price_options, row.listing_activities),
      kind_ids: listingKindIds(row.listing_activity_kinds),
      persona_ids: relationIds(row.listing_personas, "persona_id"),
      scale_ids: relationIds(row.listing_activity_scales, "activity_scale_id"),
      interest_ids: relationIds(row.listing_interests, "interest_id"),
    }))
    .filter((row) => listingMatchesGuideAudience(row, matchAudience));

  const picked = pickGuideFillListings(matched, {
    maxPrice,
    lat: input.lat,
    lng: input.lng,
    placeNames,
    radiusKm: GUIDE_NEAR_KM,
    limit: GUIDE_FILL_LIMIT,
  });
  return {
    listings: picked.matches.map(mapListingPreview),
    total: picked.total,
  };
}

export async function searchPricedGuideListings(input: {
  maxPrice: number;
  lat?: number | null;
  lng?: number | null;
  placeNames?: string[];
  audience?: GuideAudienceMatch;
}): Promise<{ listings: GuideListingPreview[]; total: number }> {
  return searchGuideFillListings(input);
}

export async function loadUnifiedGuideQueue(
  status?: string,
  viewer?: GuideViewer,
): Promise<GuideQueueRow[]> {
  const { loadEventGuideQueue } = await import("@/lib/control-room-event-guides");
  const [listings, events] = await Promise.all([
    loadGuideQueue(status, viewer),
    loadEventGuideQueue(status, viewer),
  ]);
  return [...listings, ...events].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
