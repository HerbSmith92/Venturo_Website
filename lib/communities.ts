import { createClient } from "@/lib/supabase/server";

export type CommunityStatus = "draft" | "requested" | "published" | "archived" | "suspended";

export function communityStatusLabel(status: CommunityStatus) {
  switch (status) {
    case "requested":
      return "Requested";
    case "draft":
      return "Changes Requested";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    case "suspended":
      return "Suspended";
  }
}

export type CommunityRecord = {
  id: string;
  title: string;
  slug: string;
  about: string | null;
  coverUrl: string | null;
  interest: string | null;
  placeLabel: string | null;
  socialUrl: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  phone: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  founderName: string | null;
  founderEmail: string | null;
  status: CommunityStatus;
  isFeatured: boolean;
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
  founder_name?: string | null;
  founder_email?: string | null;
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
    founderName: row.founder_name ?? null,
    founderEmail: row.founder_email ?? null,
    status: row.status,
    isFeatured: Boolean(row.is_featured),
  };
}

const SELECT =
  "id, title, slug, about, cover_url, interest, place_label, social_url, contact_email, website_url, phone, instagram_url, facebook_url, founder_name, founder_email, status, is_featured";

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
    .eq("community_id", communityId);
  if (error || !data) return [];
  return data.map((row) => row.event_id as string);
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
