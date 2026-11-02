import { createAnonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";
import { authorFromEmbed, type GuideAuthor, type GuideAuthorPublic } from "@/lib/guide-authors";
import {
  formatCents,
  formatEventWhen,
  type EventStatus,
} from "@/lib/event-types";

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";

export type EventGuideCardData = {
  id: string;
  title: string;
  slug: string;
  intro: string | null;
  cover: string;
  itemCount: number;
  about: "events";
  shape: "roundup" | "spotlight";
  authorName: string | null;
  authorId?: string | null;
  authorSlug?: string | null;
  publishAt: string | null;
};

export type EventGuideRecommendation = {
  eventId: string;
  slug: string;
  title: string;
  when: string;
  area: string;
  image: string;
  fromPrice: string | null;
  editorialNote: string | null;
};

export type PublicEventGuide = {
  id: string;
  title: string;
  slug: string;
  intro: string | null;
  body: string | null;
  shape: "roundup" | "spotlight";
  author: GuideAuthorPublic | null;
  items: EventGuideRecommendation[];
};

type TicketRow = {
  kind?: string | null;
  price_cents?: number | null;
  listed?: boolean | null;
  members_only?: boolean | null;
};

type EventEmbed = {
  id: string;
  slug: string;
  title: string;
  status: EventStatus | string | null;
  visibility: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  venue_name: string | null;
  city: string | null;
  listing_image_url: string | null;
  banner_url: string | null;
  story_image_url: string | null;
  event_ticket_types?: TicketRow[] | null;
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
  guide_authors?: GuideAuthor | GuideAuthor[] | null;
  curated_event_guide_items?: {
    sort_order: number | null;
    editorial_note: string | null;
    event_id: string;
    events?: EventEmbed | EventEmbed[] | null;
  }[];
};

function asEvent(embed: EventEmbed | EventEmbed[] | null | undefined) {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

function asNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function fromPriceCents(tickets: TicketRow[] | null | undefined) {
  const listed = (tickets ?? []).filter((ticket) => ticket.listed !== false && !ticket.members_only);
  const amounts = listed.flatMap((ticket) => {
    if (ticket.kind === "free") return [0];
    const cents = asNumber(ticket.price_cents);
    return cents != null && cents >= 0 ? [cents] : [];
  });
  if (!amounts.length) return null;
  return Math.min(...amounts);
}

function upcoming(event: EventEmbed, now: number) {
  if (event.status !== "approved" || event.visibility !== "public") return false;
  const end = event.ends_at ? Date.parse(event.ends_at) : NaN;
  const start = event.starts_at ? Date.parse(event.starts_at) : NaN;
  if (Number.isFinite(end)) return end >= now;
  if (Number.isFinite(start)) return start >= now;
  return false;
}

function mapItem(event: EventEmbed, editorialNote: string | null): EventGuideRecommendation {
  const cents = fromPriceCents(event.event_ticket_types);
  return {
    eventId: event.id,
    slug: event.slug,
    title: event.title,
    when: formatEventWhen(event.starts_at ?? "", event.timezone || "Africa/Johannesburg"),
    area: [event.venue_name, event.city].filter(Boolean).join(", ") || "South Africa",
    image: event.listing_image_url || event.banner_url || event.story_image_url || FALLBACK_IMAGE,
    fromPrice: cents == null ? null : cents === 0 ? "Free" : `From ${formatCents(cents)}`,
    editorialNote,
  };
}

const ITEM_SELECT = `
  id, title, slug, intro, body, shape, status, publish_at, expire_at,
  guide_authors ( id, display_name, slug, tagline, bio, photo_url, photo_storage_key, cover_url, cover_storage_key, instagram_url, tiktok_url, facebook_url, website_url, user_id ),
  curated_event_guide_items (
    sort_order, editorial_note, event_id,
    events (
      id, slug, title, status, visibility, starts_at, ends_at, timezone,
      venue_name, city, listing_image_url, banner_url, story_image_url,
      event_ticket_types ( kind, price_cents, listed, members_only )
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

function liveRows(rows: GuideRow[]) {
  const now = Date.now();
  return rows.flatMap((row) => {
    if (!isCurrentlyLive(row)) return [];
    const items = [...(row.curated_event_guide_items ?? [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .flatMap((item) => {
        const event = asEvent(item.events);
        if (!event || !upcoming(event, now)) return [];
        return [mapItem(event, item.editorial_note)];
      });
    if (!items.length) return [];
    return [{ row, items }];
  });
}

export async function liveEventGuides(limit = 48): Promise<EventGuideCardData[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("curated_event_guides")
    .select(ITEM_SELECT)
    .eq("status", "published")
    .order("publish_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];
  return liveRows(data as GuideRow[]).map(({ row, items }) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    intro: row.intro,
    cover: items[0]?.image ?? FALLBACK_IMAGE,
    itemCount: items.length,
    about: "events" as const,
    shape: row.shape === "spotlight" ? "spotlight" : "roundup",
    authorName: authorFromEmbed(row.guide_authors)?.name ?? null,
    authorId: authorFromEmbed(row.guide_authors)?.id ?? null,
    authorSlug: authorFromEmbed(row.guide_authors)?.slug ?? null,
    publishAt: row.publish_at ?? null,
  }));
}

export async function getPublicEventGuideBySlug(slug: string): Promise<PublicEventGuide | null> {
  const supabase = await createClient();
  if (!supabase || !slug) return null;
  const { data, error } = await supabase
    .from("curated_event_guides")
    .select(ITEM_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  const mapped = liveRows([data as GuideRow])[0];
  if (!mapped) return null;
  return {
    id: mapped.row.id,
    title: mapped.row.title,
    slug: mapped.row.slug,
    intro: mapped.row.intro,
    body: mapped.row.body ?? null,
    shape: mapped.row.shape === "spotlight" ? "spotlight" : "roundup",
    author: authorFromEmbed(mapped.row.guide_authors),
    items: mapped.items,
  };
}
