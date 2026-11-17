import "server-only";

import {
  automaticRuleOptions,
  primaryItemKindForScreen,
  type AppHomeContentCard,
  type AppHomeItemKind,
} from "@/lib/app-home-content-client";
import type { AppHomeScreen } from "@/lib/app-home-types";
import { createServiceClient } from "@/lib/supabase/admin";

export type { AppHomeContentCard, AppHomeItemKind } from "@/lib/app-home-content-client";
export { automaticRuleOptions, primaryItemKindForScreen } from "@/lib/app-home-content-client";

function coverFromMedia(
  media:
    | { public_url: string | null; is_cover: boolean | null; sort_order: number | null }[]
    | null
    | undefined,
) {
  const rows = [...(media ?? [])].sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return rows.find((row) => row.public_url)?.public_url ?? null;
}

export async function searchAppHomeContent(input: {
  screen: AppHomeScreen;
  q?: string;
  limit?: number;
}): Promise<AppHomeContentCard[]> {
  const service = createServiceClient();
  if (!service) return [];
  const q = (input.q ?? "").trim();
  const limit = Math.min(40, Math.max(1, input.limit ?? 24));
  const kind = primaryItemKindForScreen(input.screen);

  if (kind === "activity") {
    let query = service
      .from("directory_listings")
      .select(
        "id, name, suburb, city, status, is_suspended, is_featured, listing_media ( public_url, is_cover, sort_order, is_pending )",
      )
      .eq("status", "approved")
      .eq("is_suspended", false)
      .order("is_featured", { ascending: false })
      .order("name")
      .limit(limit);
    if (q) query = query.ilike("name", `%${q}%`);
    const { data } = await query;
    return (data ?? []).map((row) => ({
      id: row.id,
      kind,
      title: row.name,
      subtitle: [row.suburb, row.city].filter(Boolean).join(", ") || null,
      imageUrl: coverFromMedia(
        (row.listing_media ?? []).filter((item: { is_pending?: boolean | null }) => !item.is_pending),
      ),
      meta: row.is_featured ? "Top Pick" : "Live activity",
      available: true,
    }));
  }

  if (kind === "event") {
    let query = service
      .from("events")
      .select("id, title, venue_name, city, status, starts_at, listing_image_url, banner_url")
      .eq("status", "approved")
      .order("starts_at", { ascending: true })
      .limit(limit);
    if (q) query = query.ilike("title", `%${q}%`);
    const { data } = await query;
    return (data ?? []).map((row) => ({
      id: row.id,
      kind,
      title: row.title,
      subtitle: [row.venue_name, row.city].filter(Boolean).join(", ") || null,
      imageUrl: row.listing_image_url || row.banner_url || null,
      meta: row.starts_at ? `Starts ${new Date(row.starts_at).toISOString().slice(0, 16).replace("T", " ")}` : "Event",
      available: true,
    }));
  }

  let query = service
    .from("communities")
    .select("id, title, place_label, status, is_featured, cover_url")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("title")
    .limit(limit);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    kind,
    title: row.title,
    subtitle: row.place_label,
    imageUrl: row.cover_url,
    meta: row.is_featured ? "Featured" : "Community",
    available: true,
  }));
}

export async function resolveAppHomeCards(input: {
  kind: AppHomeItemKind;
  ids: string[];
}): Promise<AppHomeContentCard[]> {
  if (!input.ids.length) return [];
  const service = createServiceClient();
  if (!service) return [];
  const order = new Map(input.ids.map((id, index) => [id, index]));

  if (input.kind === "activity") {
    const { data } = await service
      .from("directory_listings")
      .select(
        "id, name, suburb, city, status, is_suspended, is_featured, listing_media ( public_url, is_cover, sort_order, is_pending )",
      )
      .in("id", input.ids);
    return ((data ?? []) as Array<{
      id: string;
      name: string;
      suburb: string | null;
      city: string | null;
      status: string;
      is_suspended: boolean | null;
      is_featured: boolean | null;
      listing_media?: { public_url: string | null; is_cover: boolean | null; sort_order: number | null; is_pending?: boolean | null }[];
    }>)
      .map((row) => ({
        id: row.id,
        kind: input.kind,
        title: row.name,
        subtitle: [row.suburb, row.city].filter(Boolean).join(", ") || null,
        imageUrl: coverFromMedia((row.listing_media ?? []).filter((item) => !item.is_pending)),
        meta: row.is_featured ? "Top Pick" : null,
        available: row.status === "approved" && !row.is_suspended,
      }))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  if (input.kind === "event") {
    const { data } = await service
      .from("events")
      .select("id, title, venue_name, city, status, starts_at, listing_image_url, banner_url")
      .in("id", input.ids);
    return ((data ?? []) as Array<{
      id: string;
      title: string;
      venue_name: string | null;
      city: string | null;
      status: string;
      starts_at: string | null;
      listing_image_url: string | null;
      banner_url: string | null;
    }>)
      .map((row) => ({
        id: row.id,
        kind: input.kind,
        title: row.title,
        subtitle: [row.venue_name, row.city].filter(Boolean).join(", ") || null,
        imageUrl: row.listing_image_url || row.banner_url || null,
        meta: null,
        available: row.status === "approved",
      }))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  if (input.kind === "community") {
    const { data } = await service
      .from("communities")
      .select("id, title, place_label, status, is_featured, cover_url")
      .in("id", input.ids);
    return ((data ?? []) as Array<{
      id: string;
      title: string;
      place_label: string | null;
      status: string;
      is_featured: boolean | null;
      cover_url: string | null;
    }>)
      .map((row) => ({
        id: row.id,
        kind: input.kind,
        title: row.title,
        subtitle: row.place_label,
        imageUrl: row.cover_url,
        meta: row.is_featured ? "Featured" : null,
        available: row.status === "published",
      }))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  const { data } = await service
    .from("curated_guides")
    .select("id, title, status, cover")
    .in("id", input.ids);
  return ((data ?? []) as Array<{ id: string; title: string; status: string; cover: unknown }>)
    .map((row) => ({
      id: row.id,
      kind: input.kind,
      title: row.title,
      subtitle: null,
      imageUrl: null,
      meta: null,
      available: row.status === "published",
    }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function loadAutomaticHotCards(
  screen: AppHomeScreen,
  rules: Record<string, unknown>,
  maxItems: number,
): Promise<AppHomeContentCard[]> {
  const service = createServiceClient();
  if (!service) return [];
  const limit = Math.min(24, Math.max(1, maxItems || 12));
  const rule = String(rules.rule ?? automaticRuleOptions(screen)[0]?.value ?? "featured");

  if (screen === "discover") {
    let query = service
      .from("directory_listings")
      .select(
        "id, name, suburb, city, status, is_suspended, is_featured, updated_at, listing_media ( public_url, is_cover, sort_order, is_pending )",
      )
      .eq("status", "approved")
      .eq("is_suspended", false)
      .limit(limit);
    if (rule === "featured") query = query.eq("is_featured", true).order("updated_at", { ascending: false });
    else query = query.order("updated_at", { ascending: false });
    const { data } = await query;
    const rows = data ?? [];
    if (rule === "featured" && rows.length === 0) {
      return loadAutomaticHotCards(screen, { rule: "recent" }, maxItems);
    }
    return rows.map((row) => ({
      id: row.id,
      kind: "activity" as const,
      title: row.name,
      subtitle: [row.suburb, row.city].filter(Boolean).join(", ") || null,
      imageUrl: coverFromMedia(
        (row.listing_media ?? []).filter((item: { is_pending?: boolean | null }) => !item.is_pending),
      ),
      meta: row.is_featured ? "Top Pick" : "Live activity",
      available: true,
    }));
  }

  if (screen === "events") {
    const now = new Date();
    let query = service
      .from("events")
      .select("id, title, venue_name, city, status, starts_at, listing_image_url, banner_url")
      .eq("status", "approved")
      .gte("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(limit);
    if (rule === "soonest_week") {
      const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.lte("starts_at", week);
    }
    const { data } = await query;
    return (data ?? []).map((row) => ({
      id: row.id,
      kind: "event" as const,
      title: row.title,
      subtitle: [row.venue_name, row.city].filter(Boolean).join(", ") || null,
      imageUrl: row.listing_image_url || row.banner_url || null,
      meta: "Upcoming",
      available: true,
    }));
  }

  let query = service
    .from("communities")
    .select("id, title, place_label, status, is_featured, cover_url")
    .eq("status", "published")
    .order("title")
    .limit(limit);
  if (rule === "featured") query = query.eq("is_featured", true);
  const { data } = await query;
  const rows = data ?? [];
  if (rule === "featured" && rows.length === 0) {
    return loadAutomaticHotCards(screen, { rule: "recent" }, maxItems);
  }
  return rows.map((row) => ({
    id: row.id,
    kind: "community" as const,
    title: row.title,
    subtitle: row.place_label,
    imageUrl: row.cover_url,
    meta: row.is_featured ? "Featured" : "Community",
    available: true,
  }));
}

export async function previewFilterCards(input: {
  screen: AppHomeScreen;
  rules: Record<string, unknown>;
  maxItems: number;
}): Promise<AppHomeContentCard[]> {
  const service = createServiceClient();
  if (!service) return [];
  const kind = primaryItemKindForScreen(input.screen);
  const limit = Math.min(24, Math.max(1, input.maxItems || 12));
  const interestIds = Array.isArray(input.rules.interestIds)
    ? input.rules.interestIds.map(String).filter(Boolean)
    : [];
  const minRank = Number(input.rules.minAdventureRank ?? 0);

  if (kind !== "activity") {
    return searchAppHomeContent({ screen: input.screen, limit });
  }

  let listingIds: string[] | null = null;
  if (interestIds.length) {
    const { data } = await service
      .from("listing_interests")
      .select("listing_id")
      .in("interest_id", interestIds);
    listingIds = [...new Set((data ?? []).map((row) => row.listing_id).filter(Boolean))];
    if (!listingIds.length) return [];
  }

  let query = service
    .from("directory_listings")
    .select(
      "id, name, suburb, city, status, is_suspended, is_featured, listing_media ( public_url, is_cover, sort_order, is_pending ), listing_activity_scales ( is_primary, activity_scales ( rank ) )",
    )
    .eq("status", "approved")
    .eq("is_suspended", false)
    .order("name")
    .limit(80);
  if (listingIds) query = query.in("id", listingIds);
  const { data } = await query;

  return ((data ?? []) as Array<{
    id: string;
    name: string;
    suburb: string | null;
    city: string | null;
    is_featured: boolean | null;
    listing_media?: { public_url: string | null; is_cover: boolean | null; sort_order: number | null; is_pending?: boolean | null }[];
    listing_activity_scales?: {
      is_primary: boolean | null;
      activity_scales: { rank: number | null } | { rank: number | null }[] | null;
    }[];
  }>)
    .map((row) => {
      const ranks = (row.listing_activity_scales ?? [])
        .map((entry) => {
          const scale = Array.isArray(entry.activity_scales)
            ? entry.activity_scales[0]
            : entry.activity_scales;
          return scale?.rank ?? null;
        })
        .filter((rank): rank is number => typeof rank === "number");
      const rank = ranks[0] ?? null;
      const ok = !minRank || (rank !== null && rank >= minRank);
      return {
        id: row.id,
        kind: "activity" as const,
        title: row.name,
        subtitle: [row.suburb, row.city].filter(Boolean).join(", ") || null,
        imageUrl: coverFromMedia((row.listing_media ?? []).filter((item) => !item.is_pending)),
        meta: rank ? `Level ${rank}` : row.is_featured ? "Top Pick" : null,
        available: ok,
      };
    })
    .filter((row) => row.available)
    .slice(0, limit);
}
