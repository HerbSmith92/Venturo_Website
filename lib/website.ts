import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getAppStoreLinks } from "@/lib/brand";
import { listPublishedCommunities, type CommunityRecord } from "@/lib/communities";
import { listPublicEvents, type VenturoEvent } from "@/lib/events";
import { eventCategoryColour } from "@/lib/event-style";
import { eventFeedImage, formatEventWhen } from "@/lib/event-types";
import { liveGuides, type GuideCardData } from "@/lib/guides";
import { categoryColour, listingsByCategory, type Listing } from "@/lib/listings";
import { PUBLIC_CATALOG_TAG } from "@/lib/public-cache";
import { createAnonClient } from "@/lib/supabase/anon";

export type WebsiteCopy = {
  heroEyebrow: string;
  heroTitle: string;
  heroLede: string;
  heroImageUrl: string;
  aboutTitle: string;
  aboutBody: string;
  helpTitle: string;
  helpBody: string;
  helpEmail: string;
  appStoreUrl: string;
  playStoreUrl: string;
};

const DEFAULTS: WebsiteCopy = {
  heroEyebrow: "Activities · Events · Community",
  heroTitle: "Your Next Adventure Awaits",
  heroLede:
    "A taste of the Venturo directory — places to go, people to meet, & quality time worth keeping.",
  heroImageUrl: "/brand/images/hero-family-van.jpg",
  aboutTitle: "About Venturo",
  aboutBody:
    "Venturo is a directory of activities, events & communities. The website and the app read the same places, the same events, and the same membership.",
  helpTitle: "Help & Contact",
  helpBody: "Questions about a listing, a ticket, or your membership start here.",
  helpEmail: "hello@venturo.co.za",
  appStoreUrl: "",
  playStoreUrl: "",
};

type SettingsRow = {
  hero_eyebrow: string | null;
  hero_title: string | null;
  hero_lede: string | null;
  hero_image_url: string | null;
  about_title: string | null;
  about_body: string | null;
  help_title: string | null;
  help_body: string | null;
  help_email: string | null;
  app_store_url: string | null;
  play_store_url: string | null;
};

export const loadWebsiteCopy = cache(() =>
  unstable_cache(
    async (): Promise<WebsiteCopy> => {
      const stores = getAppStoreLinks();
      const base: WebsiteCopy = {
        ...DEFAULTS,
        appStoreUrl: stores.appStore,
        playStoreUrl: stores.playStore,
      };
      const supabase = createAnonClient();
      if (!supabase) return base;
      const { data, error } = await supabase
        .from("website_settings")
        .select(
          "hero_eyebrow, hero_title, hero_lede, hero_image_url, about_title, about_body, help_title, help_body, help_email, app_store_url, play_store_url",
        )
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return base;
      const row = data as SettingsRow;
      return {
        heroEyebrow: row.hero_eyebrow?.trim() || base.heroEyebrow,
        heroTitle: row.hero_title?.trim() || base.heroTitle,
        heroLede: row.hero_lede?.trim() || base.heroLede,
        heroImageUrl: row.hero_image_url?.trim() || base.heroImageUrl,
        aboutTitle: row.about_title?.trim() || base.aboutTitle,
        aboutBody: row.about_body?.trim() || base.aboutBody,
        helpTitle: row.help_title?.trim() || base.helpTitle,
        helpBody: row.help_body?.trim() || base.helpBody,
        helpEmail: row.help_email?.trim() || base.helpEmail,
        appStoreUrl: row.app_store_url?.trim() || base.appStoreUrl,
        playStoreUrl: row.play_store_url?.trim() || base.playStoreUrl,
      };
    },
    ["website-copy"],
    { revalidate: 60, tags: [PUBLIC_CATALOG_TAG] },
  )(),
);

export type FeatureSlot = "event" | "listing" | "community" | "guide";

export async function loadFeatureIds() {
  const empty: Record<FeatureSlot, string[]> = {
    event: [],
    listing: [],
    community: [],
    guide: [],
  };
  const supabase = createAnonClient();
  if (!supabase) return empty;
  const { data, error } = await supabase
    .from("website_features")
    .select("slot, target_id, sort_order")
    .order("sort_order");
  if (error || !data) return empty;
  for (const row of data) {
    const slot = row.slot as FeatureSlot;
    if (empty[slot]) empty[slot].push(row.target_id as string);
  }
  return empty;
}

export type HomeFeatures = {
  events: VenturoEvent[];
  listings: Listing[];
  communities: CommunityRecord[];
  guides: GuideCardData[];
};

export async function loadHomeFeatures(): Promise<HomeFeatures> {
  const [ids, events, allListings, communities, guides] = await Promise.all([
    loadFeatureIds(),
    listPublicEvents({ limit: 24 }),
    listingsByCategory("all"),
    listPublishedCommunities(),
    liveGuides(12),
  ]);

  const pick = <T extends { id: string }>(rows: T[], chosen: string[], fallback: number) => {
    if (chosen.length === 0) return rows.slice(0, fallback);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = chosen.map((id) => byId.get(id)).filter((row): row is T => Boolean(row));
    return ordered.length ? ordered : rows.slice(0, fallback);
  };

  const featured = allListings.filter((listing) => listing.featured);
  const listingPool = ids.listing.length ? allListings : featured.length ? featured : allListings;
  const featuredCommunities = communities.filter((community) => community.isFeatured);
  const communityPool = ids.community.length
    ? communities
    : featuredCommunities.length
      ? featuredCommunities
      : communities;

  return {
    events: pick(events, ids.event, 12),
    listings: pick(listingPool, ids.listing, 12),
    communities: pick(communityPool, ids.community, 12),
    guides: pick(guides, ids.guide, 12),
  };
}

export type HomeHighlight = {
  id: string;
  kind: "activity" | "event" | "community" | "guide";
  href: string;
  title: string;
  kicker: string;
  meta: string;
  image: string;
  accent: string;
};

const HIGHLIGHT_FALLBACK = "/brand/images/climbing.jpg";

export function homeHighlights(features: HomeFeatures): HomeHighlight[] {
  const items: HomeHighlight[] = [];
  const take = 2;
  for (let index = 0; index < take; index += 1) {
    const listing = features.listings[index];
    if (listing) {
      items.push({
        id: listing.id,
        kind: "activity",
        href: `/directory/${listing.slug}`,
        title: listing.name,
        kicker: "Activity",
        meta: listing.area || listing.vibe,
        image: listing.image || HIGHLIGHT_FALLBACK,
        accent: categoryColour(listing.category),
      });
    }
    const event = features.events[index];
    if (event) {
      items.push({
        id: event.id,
        kind: "event",
        href: event.slug
          ? `/events/${event.slug}${event.startsAt ? `?on=${encodeURIComponent(event.startsAt)}` : ""}`
          : "/events",
        title: event.title,
        kicker: "Event",
        meta: [
          event.startsAt ? formatEventWhen(event.startsAt, event.timezone) : null,
          event.city,
        ]
          .filter(Boolean)
          .join(" · "),
        image: eventFeedImage(event),
        accent: eventCategoryColour(event.category),
      });
    }
    const community = features.communities[index];
    if (community) {
      items.push({
        id: community.id,
        kind: "community",
        href: `/communities/${community.slug}`,
        title: community.title,
        kicker: "Community",
        meta: [community.placeLabel, community.interest].filter(Boolean).join(" · "),
        image: community.coverUrl || HIGHLIGHT_FALLBACK,
        accent: "var(--blush)",
      });
    }
    const guide = features.guides[index];
    if (guide) {
      items.push({
        id: guide.id,
        kind: "guide",
        href: `/guides/${guide.slug}`,
        title: guide.title,
        kicker: "Guide",
        meta: guide.authorName ? `By ${guide.authorName}` : "Hand-picked",
        image: guide.cover || HIGHLIGHT_FALLBACK,
        accent: guide.category ? categoryColour(guide.category) : "var(--jade)",
      });
    }
  }
  return items;
}
