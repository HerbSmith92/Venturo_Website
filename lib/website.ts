import { getAppStoreLinks } from "@/lib/brand";
import { listPublishedCommunities, type CommunityRecord } from "@/lib/communities";
import { listPublicEvents, type VenturoEvent } from "@/lib/events";
import { liveGuides, type GuideCardData } from "@/lib/guides";
import { listingsByCategory, type Listing } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

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

export async function loadWebsiteCopy(): Promise<WebsiteCopy> {
  const stores = getAppStoreLinks();
  const base: WebsiteCopy = {
    ...DEFAULTS,
    appStoreUrl: stores.appStore,
    playStoreUrl: stores.playStore,
  };
  const supabase = await createClient();
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
}

export type FeatureSlot = "event" | "listing" | "community" | "guide";

export async function loadFeatureIds() {
  const empty: Record<FeatureSlot, string[]> = {
    event: [],
    listing: [],
    community: [],
    guide: [],
  };
  const supabase = await createClient();
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
    listPublicEvents(),
    listingsByCategory("all"),
    listPublishedCommunities(),
    liveGuides(40),
  ]);

  const pick = <T extends { id: string }>(rows: T[], chosen: string[], fallback: number) => {
    if (chosen.length === 0) return rows.slice(0, fallback);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = chosen.map((id) => byId.get(id)).filter((row): row is T => Boolean(row));
    return ordered.length ? ordered : rows.slice(0, fallback);
  };

  const featured = allListings.filter((listing) => listing.featured);
  const listingPool = ids.listing.length ? allListings : featured.length ? featured : allListings;

  return {
    events: pick(events, ids.event, 6),
    listings: pick(listingPool, ids.listing, 8),
    communities: pick(communities, ids.community, 4),
    guides: pick(guides, ids.guide, 3),
  };
}
