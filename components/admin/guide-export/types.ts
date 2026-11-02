import type { GuideDraftItem } from "@/lib/guide-shared";

export const IG_POST_WIDTH = 1080;
export const IG_POST_HEIGHT = 1350;

/** Design-system activity colours — band accent follows the listing’s activity kind. */
const CATEGORY_COLOURS: Record<string, string> = {
  adventure: "#45A67F",
  thrills: "#FF9E6B",
  family: "#DC729E",
  romance: "#D54732",
  team: "#F3BF4A",
  nightlife: "#5E589E",
  workshop: "#FF2EFF",
  markets: "#971A21",
  digital: "#7CC3E9",
  "third-party": "#14001A",
};

const FALLBACK_ACCENT = "#45A67F";

export const FALLBACK_EXPORT_IMAGE = "/brand/images/climbing.jpg";

function accentForActivityKind(key: string | null | undefined) {
  if (!key) return FALLBACK_ACCENT;
  return CATEGORY_COLOURS[key] ?? FALLBACK_ACCENT;
}

function inkForAccent(accent: string): "night" | "snow" {
  switch (accent.toUpperCase()) {
    case "#D54732":
    case "#5E589E":
    case "#971A21":
    case "#14001A":
      return "snow";
    default:
      return "night";
  }
}

export type GuideExportSlide =
  | {
      kind: "intro";
      title: string;
      intro: string;
      cover: string;
      spotCount: number;
    }
  | {
      kind: "activity";
      index: number;
      spotCount: number;
      name: string;
      description: string;
      category: string;
      area: string;
      price: string;
      image: string;
      accent: string;
      ink: "night" | "snow";
    };

function friendlyCity(value: string) {
  if (/^johannesburg$/i.test(value.trim())) return "Joburg";
  return value.trim();
}

export function areaFromListing(item: GuideDraftItem) {
  const listing = item.listing;
  if (!listing) return "South Africa";
  const suburb = (listing.suburb ?? "").trim();
  const city = friendlyCity(listing.city ?? "");
  return [suburb, city].filter(Boolean).join(", ") || "South Africa";
}

function truncateCopy(value: string, max: number) {
  const text = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.([A-Za-z])/g, ". $1");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Prefer a short experience pitch over a full directory blurb. Two lines on the card. */
function experienceDescription(item: GuideDraftItem) {
  const raw = (item.listing?.short_description ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.([A-Za-z])/g, ". $1");
  if (!raw) return "Worth getting out of the house for.";

  const afterIs = raw.match(/\bis an?\s+(.+)$/i)?.[1] ?? raw.match(/\bis\s+(.+)$/i)?.[1];
  const candidate = afterIs
    ? afterIs.charAt(0).toUpperCase() + afterIs.slice(1)
    : raw;
  const firstSentence = candidate.split(/(?<=[.!?])\s+/)[0] ?? candidate;

  return truncateCopy(firstSentence, 92);
}

function formatExportPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "See directory";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "See directory";
  return `From R ${Math.round(n)}`;
}

export function buildGuideExportSlides(input: {
  title: string;
  intro: string;
  items: GuideDraftItem[];
}): GuideExportSlide[] {
  const title = input.title.trim() || "Untitled Guide";
  const items = input.items;
  const cover =
    items.find((item) => item.listing?.image)?.listing?.image ?? FALLBACK_EXPORT_IMAGE;

  const slides: GuideExportSlide[] = [
    {
      kind: "intro",
      title,
      intro: truncateCopy(input.intro.trim(), 92),
      cover,
      spotCount: items.length,
    },
  ];

  items.forEach((item, index) => {
    const listing = item.listing;
    const accent = accentForActivityKind(listing?.activity_kind_key);
    slides.push({
      kind: "activity",
      index: index + 1,
      spotCount: items.length,
      name: (listing?.name ?? "Listing missing").trim(),
      description: experienceDescription(item),
      category: (listing?.activity_kind_title ?? "").trim(),
      area: areaFromListing(item),
      price: formatExportPrice(listing?.price_from ?? null),
      image: listing?.image ?? FALLBACK_EXPORT_IMAGE,
      accent,
      ink: inkForAccent(accent),
    });
  });

  return slides;
}

export function exportFileSlug(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "guide";
}

export function padSlideIndex(value: number) {
  return String(value).padStart(2, "0");
}
