import { createClient } from "@/lib/supabase/server";
import type { CommunityEventLink, CommunityPhoto, CommunityRecord, CommunityStatus } from "@/lib/community-shared";

export type { CommunityEventLink, CommunityPhoto, CommunityRecord, CommunityStatus };
export { communityStatusLabel } from "@/lib/community-shared";

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
  };
}

const SELECT =
  "id, title, slug, about, cover_url, interest, place_label, social_url, contact_email, website_url, phone, instagram_url, facebook_url, tiktok_url, founder_name, founder_email, areas, interest_keywords, scale_id, status, is_featured";

export async function listCommunities(status?: CommunityStatus | "all") {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("communities").select(SELECT).order("title");
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as CommunityRow[]).map(mapCommunity);
}

export async function listPublishedCommunities() {
  return listCommunities("published");
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
