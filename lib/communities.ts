import { cache } from "react";
import { revalidatePath, unstable_cache } from "next/cache";
import {
  audienceAllowedForCommunity,
  parseContentAudience,
  requiredEventAudienceForCommunity,
  type ContentAudience,
} from "@/lib/content-audience";
import { bustPublicCatalog, PUBLIC_CATALOG_TAG } from "@/lib/public-cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  filterByAudience,
  loadAudienceViewer,
  type AudienceViewer,
} from "@/lib/audience";
import type { CommunityEventLink, CommunityPhoto, CommunityRecord, CommunityStatus } from "@/lib/community-shared";

export type { CommunityEventLink, CommunityPhoto, CommunityRecord, CommunityStatus };
export { communityStatusLabel } from "@/lib/community-shared";

export type EventCommunitySummary = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: CommunityStatus;
  audience: ContentAudience;
};

export type CommunityEventAudienceMismatch = {
  id: string;
  title: string;
  slug: string;
  audience: ContentAudience;
};

type CommunityRow = {
  id: string;
  title: string;
  slug: string;
  about: string | null;
  cover_url: string | null;
  interest: string | null;
  place_label: string | null;
  social_url: string | null;
  contact_email: string | null;
  website_url?: string | null;
  phone?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  founder_name?: string | null;
  founder_email?: string | null;
  areas?: string[] | null;
  interest_keywords?: string | null;
  scale_id?: string | null;
  status: CommunityStatus;
  is_featured: boolean | null;
  claimed_by?: string | null;
  audience?: string | null;
};

function mapCommunity(row: CommunityRow): CommunityRecord {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    about: row.about,
    coverUrl: row.cover_url,
    interest: row.interest,
    placeLabel: row.place_label,
    socialUrl: row.social_url,
    contactEmail: row.contact_email,
    websiteUrl: row.website_url ?? null,
    phone: row.phone ?? null,
    instagramUrl: row.instagram_url ?? null,
    facebookUrl: row.facebook_url ?? null,
    tiktokUrl: row.tiktok_url ?? null,
    founderName: row.founder_name ?? null,
    founderEmail: row.founder_email ?? null,
    areas: row.areas ?? [],
    interestKeywords: row.interest_keywords ?? "",
    scaleId: row.scale_id ?? null,
    status: row.status,
    isFeatured: Boolean(row.is_featured),
    claimedBy: row.claimed_by ?? null,
    audience: parseContentAudience(row.audience),
  };
}

const SELECT =
  "id, title, slug, about, cover_url, interest, place_label, social_url, contact_email, website_url, phone, instagram_url, facebook_url, tiktok_url, founder_name, founder_email, areas, interest_keywords, scale_id, status, is_featured, claimed_by, audience";

export async function listCommunities(status?: CommunityStatus | "all") {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("communities").select(SELECT).order("title");
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as CommunityRow[]).map(mapCommunity);
}

export const listPublishedCommunities = cache(() =>
  unstable_cache(
    async () => {
      const supabase = createAnonClient();
      if (!supabase) return [];
      const { data, error } = await supabase.from("communities").select(SELECT).eq("status", "published").order("title");
      if (error || !data) return [];
      return (data as CommunityRow[]).map(mapCommunity);
    },
    ["published-communities"],
    { revalidate: 60, tags: [PUBLIC_CATALOG_TAG] },
  )(),
);

/** Published communities visible to this viewer (audience-filtered). */
export async function listVisiblePublishedCommunities(viewer?: AudienceViewer) {
  const communities = await listPublishedCommunities();
  const resolved = viewer ?? (await loadAudienceViewer());
  return filterByAudience(communities, resolved);
}

export async function listClaimedCommunities(userId: string) {
  const supabase = createServiceClient() ?? (await createClient());
  if (!supabase) return [];
  const { data: managed } = await supabase
    .from("community_managers")
    .select("community_id")
    .eq("user_id", userId)
    .eq("status", "active");
  const managedIds = (managed ?? []).map((row) => String(row.community_id));
  if (managedIds.length) {
    const { data, error } = await supabase
      .from("communities")
      .select(SELECT)
      .in("id", managedIds)
      .order("title");
    if (!error && data) return (data as CommunityRow[]).map(mapCommunity);
  }
  const { data, error } = await supabase
    .from("communities")
    .select(SELECT)
    .eq("claimed_by", userId)
    .order("title");
  if (error || !data) return [];
  return (data as CommunityRow[]).map(mapCommunity);
}

export async function getCommunityBySlug(slug: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("communities")
    .select(SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return mapCommunity(data as CommunityRow);
}

export async function getCommunityById(id: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("communities").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapCommunity(data as CommunityRow);
}

export async function listEventIdsByCommunity(communityIds: string[]) {
  const grouped = new Map<string, string[]>();
  if (!communityIds.length) return grouped;
  const supabase = await createClient();
  if (!supabase) return grouped;
  const { data, error } = await supabase
    .from("community_events")
    .select("community_id, event_id")
    .in("community_id", communityIds)
    .eq("link_status", "approved");
  if (error || !data) return grouped;
  for (const row of data) {
    const communityId = row.community_id as string;
    const events = grouped.get(communityId) ?? [];
    events.push(row.event_id as string);
    grouped.set(communityId, events);
  }
  return grouped;
}

export async function listCommunityEventIds(communityId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_events")
    .select("event_id")
    .eq("community_id", communityId)
    .eq("link_status", "approved");
  if (error || !data) return [];
  return data.map((row) => row.event_id as string);
}

export async function listCommunityPhotos(communityId: string): Promise<CommunityPhoto[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_photos")
    .select("id, public_url, storage_key, is_cover, sort_order")
    .eq("community_id", communityId)
    .order("sort_order");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    publicUrl: row.public_url as string,
    storageKey: row.storage_key as string,
    isCover: Boolean(row.is_cover),
    sortOrder: (row.sort_order as number) ?? 0,
  }));
}

export async function listCommunityKindIds(communityId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_activity_kinds")
    .select("activity_kind_id")
    .eq("community_id", communityId);
  if (error || !data) return [];
  return data.map((row) => row.activity_kind_id as string);
}

export async function listCommunityPersonaIds(communityId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_personas")
    .select("persona_id")
    .eq("community_id", communityId);
  if (error || !data) return [];
  return data.map((row) => row.persona_id as string);
}

export async function listCommunityEventLinks(communityId: string): Promise<CommunityEventLink[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_events")
    .select("link_status, events (id, title, slug, starts_at, status, city)")
    .eq("community_id", communityId);
  if (error || !data) return [];
  return data.flatMap((row) => {
    const event = row.events as
      | {
          id: string;
          title: string;
          slug: string;
          starts_at: string | null;
          status: string;
          city: string | null;
        }
      | {
          id: string;
          title: string;
          slug: string;
          starts_at: string | null;
          status: string;
          city: string | null;
        }[]
      | null;
    const item = Array.isArray(event) ? event[0] : event;
    if (!item) return [];
    return [
      {
        id: item.id,
        title: item.title,
        slug: item.slug,
        startsAt: item.starts_at,
        city: item.city,
        status: item.status,
        linkStatus: row.link_status === "pending" ? "pending" : "approved",
      } satisfies CommunityEventLink,
    ];
  });
}

export async function isFollowingCommunity(userId: string, communityId: string) {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("community_follows")
    .select("community_id")
    .eq("user_id", userId)
    .eq("community_id", communityId)
    .maybeSingle();
  return Boolean(data);
}

export async function listFollowedCommunities(userId: string) {
  const ids = await listFollowedCommunityIds(userId);
  if (ids.length === 0) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("communities").select(SELECT).in("id", ids).order("title");
  if (error || !data) return [];
  return (data as CommunityRow[]).map(mapCommunity);
}

export async function listFollowedCommunityIds(userId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_follows")
    .select("community_id")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((row) => row.community_id as string);
}

function toEventCommunitySummary(row: CommunityRow): EventCommunitySummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverUrl: row.cover_url,
    status: row.status,
    audience: parseContentAudience(row.audience),
  };
}

/** Approved community linked to an event, or null. */
export async function getEventCommunity(eventId: string): Promise<EventCommunitySummary | null> {
  if (!eventId) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("community_events")
    .select("communities ( id, title, slug, cover_url, status, audience )")
    .eq("event_id", eventId)
    .eq("link_status", "approved")
    .maybeSingle();
  if (error || !data) return null;
  const community = data.communities as
    | CommunityRow
    | CommunityRow[]
    | null;
  const row = Array.isArray(community) ? community[0] : community;
  if (!row) return null;
  return toEventCommunitySummary(row);
}

function revalidateEventCommunityPaths(eventSlug: string | null, community: { slug: string } | null) {
  if (eventSlug) revalidatePath(`/events/${eventSlug}`);
  revalidatePath("/events");
  if (community?.slug) revalidatePath(`/communities/${community.slug}`);
  revalidatePath("/communities");
  revalidatePath("/admin/events");
  revalidatePath("/admin/communities");
  bustPublicCatalog();
}

/**
 * Link one approved community to an event (or clear). Does not change organiser_id.
 * When audiences mismatch and cascadeAudience is false, returns needsCascade.
 */
export async function setEventCommunity(
  eventId: string,
  communityId: string | null,
  options?: { cascadeAudience?: boolean; eventAudience?: ContentAudience },
): Promise<
  | { ok: true; community: EventCommunitySummary | null }
  | { ok: false; error: string; needsCascade?: boolean; communityAudience?: ContentAudience }
> {
  const supabase = await createClient();
  if (!supabase || !eventId) return { ok: false, error: "Could not update that community link." };

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, slug, audience")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError || !event) return { ok: false, error: "Event not found." };

  const eventAudience = parseContentAudience(
    options?.eventAudience ?? (event.audience as string | null),
  );
  let nextCommunity: EventCommunitySummary | null = null;

  if (communityId) {
    const { data: community, error: communityError } = await supabase
      .from("communities")
      .select(SELECT)
      .eq("id", communityId)
      .maybeSingle();
    if (communityError || !community) return { ok: false, error: "Community not found." };
    nextCommunity = toEventCommunitySummary(community as CommunityRow);
    const communityAudience = nextCommunity.audience;

    if (!audienceAllowedForCommunity(communityAudience, eventAudience)) {
      if (!options?.cascadeAudience) {
        return {
          ok: false,
          error: `This community is ${communityAudience === "women" ? "Women only" : "Men only"}. Confirm to update the event audience to match.`,
          needsCascade: true,
          communityAudience,
        };
      }
      const nextAudience = requiredEventAudienceForCommunity(communityAudience, eventAudience);
      const { error: audienceError } = await supabase
        .from("events")
        .update({ audience: nextAudience, updated_at: new Date().toISOString() })
        .eq("id", eventId);
      if (audienceError) return { ok: false, error: audienceError.message };
    }

    const { error: clearError } = await supabase
      .from("community_events")
      .delete()
      .eq("event_id", eventId)
      .eq("link_status", "approved")
      .neq("community_id", communityId);
    if (clearError) return { ok: false, error: clearError.message };

    const { data: existing } = await supabase
      .from("community_events")
      .select("community_id, link_status")
      .eq("event_id", eventId)
      .eq("community_id", communityId)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from("community_events")
        .update({ link_status: "approved" })
        .eq("event_id", eventId)
        .eq("community_id", communityId);
      if (updateError) return { ok: false, error: updateError.message };
    } else {
      const { error: insertError } = await supabase.from("community_events").insert({
        community_id: communityId,
        event_id: eventId,
        link_status: "approved",
      });
      if (insertError) return { ok: false, error: insertError.message };
    }
  } else {
    const { error: clearError } = await supabase
      .from("community_events")
      .delete()
      .eq("event_id", eventId)
      .eq("link_status", "approved");
    if (clearError) return { ok: false, error: clearError.message };
  }

  revalidateEventCommunityPaths((event.slug as string) ?? null, nextCommunity);
  return { ok: true, community: nextCommunity };
}

/** Approved linked events whose audience would not match the community audience. */
export async function listCommunityAudienceMismatches(
  communityId: string,
  communityAudience: ContentAudience,
): Promise<CommunityEventAudienceMismatch[]> {
  if (!communityId || communityAudience === "all") return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_events")
    .select("events ( id, title, slug, audience )")
    .eq("community_id", communityId)
    .eq("link_status", "approved");
  if (error || !data) return [];
  return data.flatMap((row) => {
    const event = row.events as
      | { id: string; title: string; slug: string; audience: string | null }
      | { id: string; title: string; slug: string; audience: string | null }[]
      | null;
    const item = Array.isArray(event) ? event[0] : event;
    if (!item) return [];
    const audience = parseContentAudience(item.audience);
    if (audienceAllowedForCommunity(communityAudience, audience)) return [];
    return [{ id: item.id, title: item.title, slug: item.slug, audience }];
  });
}

export async function cascadeCommunityEventAudiences(
  communityId: string,
  communityAudience: ContentAudience,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  if (communityAudience === "all") return { ok: true, updated: 0 };
  const mismatches = await listCommunityAudienceMismatches(communityId, communityAudience);
  if (!mismatches.length) return { ok: true, updated: 0 };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Could not update linked events." };
  const ids = mismatches.map((item) => item.id);
  const { error } = await supabase
    .from("events")
    .update({ audience: communityAudience, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  for (const item of mismatches) {
    revalidatePath(`/events/${item.slug}`);
  }
  revalidatePath("/events");
  return { ok: true, updated: mismatches.length };
}
