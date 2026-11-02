export type GuideAuthor = {
  id: string;
  display_name: string;
  slug: string;
  tagline: string | null;
  bio: string | null;
  photo_url: string | null;
  photo_storage_key: string | null;
  cover_url?: string | null;
  cover_storage_key?: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  website_url: string | null;
  user_id: string | null;
  updated_at?: string | null;
};

export type GuideAuthorPublic = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  bio: string | null;
  photo: string | null;
  cover: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
};

export type AuthorLatestGuide = {
  title: string;
  href: string;
  image: string | null;
};

export function authorSocialHref(
  raw: string | null | undefined,
  network: "instagram" | "tiktok" | "facebook" | "website",
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, "").replace(/^\/+/, "");
  if (network === "instagram") {
    return `https://instagram.com/${handle.replace(/^(www\.)?instagram\.com\//i, "")}`;
  }
  if (network === "tiktok") {
    return `https://tiktok.com/@${handle.replace(/^@/, "").replace(/^(www\.)?tiktok\.com\/@?/i, "")}`;
  }
  if (network === "facebook") {
    return `https://facebook.com/${handle.replace(/^(www\.)?facebook\.com\//i, "")}`;
  }
  if (handle.includes(".")) return `https://${handle}`;
  return `https://${handle}`;
}

export function mapGuideAuthor(row: GuideAuthor): GuideAuthorPublic {
  return {
    id: row.id,
    slug: row.slug,
    name: row.display_name,
    tagline: row.tagline,
    bio: row.bio,
    photo: row.photo_url,
    cover: row.cover_url ?? null,
    instagramUrl: row.instagram_url,
    tiktokUrl: row.tiktok_url,
    facebookUrl: row.facebook_url,
    websiteUrl: row.website_url,
  };
}

export function authorFromEmbed(
  embed: GuideAuthor | GuideAuthor[] | null | undefined,
): GuideAuthorPublic | null {
  if (!embed) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  if (!row?.display_name || !row.slug) return null;
  return mapGuideAuthor(row);
}

export const AUTHOR_SELECT =
  "id, display_name, slug, tagline, bio, photo_url, photo_storage_key, cover_url, cover_storage_key, instagram_url, tiktok_url, facebook_url, website_url, user_id, updated_at";
