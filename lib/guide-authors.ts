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

function looseUrl(value: string) {
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value);
    if (/^(www\.)?(instagram|tiktok|facebook)\.com\//i.test(value)) return new URL(`https://${value}`);
  } catch {
    return null;
  }
  return null;
}

function firstSegment(pathname: string) {
  return pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "") ?? "";
}

function hostOf(url: URL) {
  return url.hostname.replace(/^www\./i, "").toLowerCase();
}

export function authorSocialHref(
  raw: string | null | undefined,
  network: "instagram" | "tiktok" | "facebook" | "website",
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const parsed = looseUrl(value);

  if (network === "instagram") {
    const fromSite = parsed && hostOf(parsed) === "instagram.com";
    const handle = (
      fromSite
        ? firstSegment(parsed.pathname)
        : value.replace(/^@/, "").replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    )
      .split(/[/?#]/)[0]
      .replace(/^@/, "");
    if (!handle || /^(p|reel|reels|stories|explore|share)$/i.test(handle)) {
      return parsed ? `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}` : null;
    }
    return `https://www.instagram.com/${handle}`;
  }
  if (network === "tiktok") {
    const fromSite = parsed && hostOf(parsed) === "tiktok.com";
    const handle = (
      fromSite
        ? firstSegment(parsed.pathname)
        : value.replace(/^@/, "").replace(/^(https?:\/\/)?(www\.)?tiktok\.com\/@?/i, "")
    )
      .split(/[/?#]/)[0]
      .replace(/^@/, "");
    if (!handle) return parsed ? `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}` : null;
    return `https://www.tiktok.com/@${handle}`;
  }
  if (network === "facebook") {
    const fromSite = parsed && hostOf(parsed) === "facebook.com";
    const handle = (
      fromSite
        ? firstSegment(parsed.pathname)
        : value.replace(/^@/, "").replace(/^(https?:\/\/)?(www\.)?facebook\.com\//i, "")
    )
      .split(/[/?#]/)[0]
      .replace(/^@/, "");
    if (!handle) return parsed ? `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}` : null;
    return `https://www.facebook.com/${handle}`;
  }
  if (parsed) return parsed.href;
  const host = value.replace(/^\/+/, "");
  return /^https?:\/\//i.test(host) ? host : `https://${host}`;
}

export function instagramHandle(raw: string | null | undefined) {
  const href = authorSocialHref(raw, "instagram");
  if (!href) return "";
  const match = href.match(/instagram\.com\/([^/?#]+)/i);
  const handle = (match?.[1] ?? "").replace(/^@/, "");
  return handle ? `@${handle}` : "";
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
