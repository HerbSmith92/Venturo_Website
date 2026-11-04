import { canManageGuide, type GuideViewer } from "@/lib/guide-access";
import { createClient } from "@/lib/supabase/server";
import {
  GUIDE_FILL_LIMIT,
  GUIDE_NEAR_KM,
  isGuideStatus,
  type GuidePlace,
  type GuideStatus,
} from "@/lib/guide-shared";
import { loadGuidePlaces } from "@/lib/control-room-guides";
import {
  eventGuideHasAudience,
  eventMatchesGuideAudience,
  pickEventGuideMatches,
  type EventGuideAudience,
  type EventGuideDraftItem,
  type EventGuidePreview,
} from "@/lib/event-guide-shared";

export { loadGuidePlaces };

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";

const EVENT_SELECT = `
  id, slug, title, category, audience_gender, format, tags,
  listing_image_url, banner_url, story_image_url, starts_at, timezone,
  venue_name, city, latitude, longitude, status, visibility, ends_at,
  event_ticket_types ( kind, price_cents, listed, members_only, quantity, sold_count )
`;

type TicketRow = {
  kind?: string | null;
  price_cents?: number | null;
  listed?: boolean | null;
  members_only?: boolean | null;
  quantity?: number | null;
  sold_count?: number | null;
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  audience_gender: string | null;
  format: string | null;
  tags: string[] | null;
  listing_image_url: string | null;
  banner_url: string | null;
  story_image_url: string | null;
  starts_at: string | null;
  timezone: string | null;
  venue_name: string | null;
  city: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  status: string;
  visibility?: string | null;
  ends_at?: string | null;
  event_ticket_types?: TicketRow[] | null;
};

export type EventGuideQueueRow = {
  id: string;
  title: string;
  slug: string;
  status: GuideStatus;
  publish_at: string | null;
  expire_at: string | null;
  updated_at: string;
  item_count: number;
  about: "events";
  shape: string;
  author_name: string | null;
  author_photo: string | null;
  cover: string | null;
  created_by: string;
};

export type EventGuideEditorRecord = {
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
  max_price_cents: number | null;
  place_id: string | null;
  place_ids: string[];
  interest_labels: string[];
  persona_labels: string[];
  energy_ranks: number[];
  items: EventGuideDraftItem[];
  created_by: string;
};

function asNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function eventFromPriceCents(tickets: TicketRow[] | null | undefined) {
  const listed = (tickets ?? []).filter((ticket) => ticket.listed !== false && !ticket.members_only);
  const amounts = listed.flatMap((ticket) => {
    if (ticket.kind === "free") return [0];
    const cents = asNumber(ticket.price_cents);
    return cents != null && cents >= 0 ? [cents] : [];
  });
  if (!amounts.length) return null;
  return Math.min(...amounts);
}

function mapPreview(row: EventRow): EventGuidePreview {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    audienceGender: row.audience_gender || "Everyone",
    format: row.format,
    tags: row.tags ?? [],
    startsAt: row.starts_at ?? "",
    timezone: row.timezone || "Africa/Johannesburg",
    venueName: row.venue_name ?? "",
    city: row.city,
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    image: row.listing_image_url || row.banner_url || row.story_image_url || FALLBACK_IMAGE,
    fromPriceCents: eventFromPriceCents(row.event_ticket_types),
    status: row.status,
  };
}

function upcomingQuery(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>) {
  const nowIso = new Date().toISOString();
  return supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "approved")
    .eq("visibility", "public")
    .or(`ends_at.gte."${nowIso}",starts_at.gte."${nowIso}",repeat_until.gte."${nowIso}"`)
    .order("starts_at", { ascending: true })
    .limit(500);
}

export async function loadEventGuideQueue(
  status?: string,
  viewer?: GuideViewer,
): Promise<EventGuideQueueRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("curated_event_guides")
    .select(
      `
      id, title, slug, status, publish_at, expire_at, updated_at, shape, created_by, author_id,
      curated_event_guide_items ( id, sort_order, events ( listing_image_url, banner_url, story_image_url ) ),
      guide_authors ( display_name, photo_url )
    `,
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status && isGuideStatus(status)) query = query.eq("status", status);

  const { data, error } = await query;
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
      created_by: string;
      author_id?: string | null;
      curated_event_guide_items?: {
        id?: string;
        sort_order?: number | null;
        events?: EventRow | EventRow[] | null;
      }[];
      guide_authors?: { display_name: string; photo_url?: string | null } | { display_name: string; photo_url?: string | null }[] | null;
    }[]
  )
    .filter((row) => canManageGuide(row, viewer))
    .map((row) => {
      const author = Array.isArray(row.guide_authors) ? row.guide_authors[0] : row.guide_authors;
      const items = [...(row.curated_event_guide_items ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      );
      let cover: string | null = null;
      for (const item of items) {
        const event = Array.isArray(item.events) ? item.events[0] : item.events;
        cover = event?.listing_image_url || event?.banner_url || event?.story_image_url || null;
        if (cover) break;
      }
      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status,
        publish_at: row.publish_at,
        expire_at: row.expire_at,
        updated_at: row.updated_at,
        item_count: row.curated_event_guide_items?.length ?? 0,
        about: "events" as const,
        shape: row.shape || "roundup",
        author_name: author?.display_name ?? null,
        author_photo: author?.photo_url ?? null,
        cover,
        created_by: row.created_by,
      };
    });
}

export async function loadEventGuideEditor(id: string): Promise<EventGuideEditorRecord | null> {
  const supabase = await createClient();
  if (!supabase || !id) return null;

  let { data, error } = await supabase
    .from("curated_event_guides")
    .select(
      `
      id, title, slug, intro, body, shape, author_id, status, publish_at, expire_at, max_price_cents, place_id,
      place_ids, interest_labels, persona_labels, energy_ranks, created_by,
      curated_event_guide_items (
        event_id, sort_order, editorial_note,
        events ( ${EVENT_SELECT} )
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    const retry = await supabase
      .from("curated_event_guides")
      .select(
        `
      id, title, slug, intro, body, shape, author_id, status, publish_at, expire_at, max_price_cents, place_id,
      interest_labels, persona_labels, energy_ranks, created_by,
      curated_event_guide_items (
        event_id, sort_order, editorial_note,
        events ( ${EVENT_SELECT} )
      )
    `,
      )
      .eq("id", id)
      .maybeSingle();
    data = retry.data as typeof data;
    error = retry.error;
  }
  if (error || !data) return null;

  type ItemRow = {
    event_id: string;
    sort_order: number | null;
    editorial_note: string | null;
    events?: EventRow | EventRow[] | null;
  };

  const row = data as {
    id: string;
    title: string;
    slug: string;
    intro: string | null;
    body: string | null;
    shape: "roundup" | "spotlight" | null;
    author_id: string | null;
    status: GuideStatus;
    publish_at: string | null;
    expire_at: string | null;
    max_price_cents: number | null;
    place_id: string | null;
    place_ids?: string[] | null;
    interest_labels: string[] | null;
    persona_labels: string[] | null;
    energy_ranks: number[] | null;
    created_by: string;
    curated_event_guide_items?: ItemRow[];
  };

  const items = [...(row.curated_event_guide_items ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => {
      const event = Array.isArray(item.events) ? item.events[0] : item.events;
      return {
        event_id: item.event_id,
        editorial_note: item.editorial_note ?? "",
        event: event ? mapPreview(event) : null,
      };
    });

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    intro: row.intro,
    body: row.body,
    shape: row.shape === "spotlight" ? "spotlight" : "roundup",
    author_id: row.author_id,
    status: row.status,
    publish_at: row.publish_at,
    expire_at: row.expire_at,
    max_price_cents: row.max_price_cents,
    place_id: row.place_id,
    place_ids: Array.isArray(row.place_ids)
      ? row.place_ids.filter(Boolean)
      : row.place_id
        ? [row.place_id]
        : [],
    interest_labels: row.interest_labels ?? [],
    persona_labels: row.persona_labels ?? [],
    energy_ranks: row.energy_ranks ?? [],
    items,
    created_by: row.created_by,
  };
}

export async function searchEventGuideEvents(
  q: string,
): Promise<EventGuidePreview[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const name = q.trim();
  let query = upcomingQuery(supabase);
  if (name) query = query.ilike("title", `%${name}%`);
  const { data, error } = await query.limit(24);
  if (error || !data) return [];
  return (data as EventRow[]).map(mapPreview);
}

export async function searchEventGuideFill(input: {
  maxPriceCents?: number | null;
  lat?: number | null;
  lng?: number | null;
  placeNames?: string[];
  audience?: EventGuideAudience;
}): Promise<{ events: EventGuidePreview[]; total: number; error?: string }> {
  const supabase = await createClient();
  const audience = input.audience ?? { interestLabels: [], personaLabels: [], energyRanks: [] };
  const maxPrice = input.maxPriceCents;
  const placeNames = (input.placeNames ?? []).map((item) => item.trim()).filter(Boolean);
  const hasPlace = placeNames.length > 0 || (input.lat != null && input.lng != null);
  if (!supabase || (!maxPrice && !hasPlace && !eventGuideHasAudience(audience))) {
    return { events: [], total: 0 };
  }

  const { data, error } = await upcomingQuery(supabase);
  if (error || !data) {
    return { events: [], total: 0, error: "Those events could not be loaded." };
  }

  const matched = (data as EventRow[])
    .map((row) => {
      const preview = mapPreview(row);
      return { ...preview, category: row.category, tags: row.tags ?? [], format: row.format };
    })
    .filter((row) => eventMatchesGuideAudience(row, audience));

  const picked = pickEventGuideMatches(matched, {
    maxPriceCents: maxPrice,
    lat: input.lat,
    lng: input.lng,
    placeNames,
    radiusKm: GUIDE_NEAR_KM,
    limit: GUIDE_FILL_LIMIT,
  });
  return { events: picked.matches, total: picked.total };
}

export type { GuidePlace };
