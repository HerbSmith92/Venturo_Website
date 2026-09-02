import type { GuideDraftItem } from "@/lib/guide-shared";

export const IG_POST_WIDTH = 1080;
export const IG_POST_HEIGHT = 1350;

/** Keep labels/colours local so this module stays client-safe (no server imports). */
const CATEGORY_LABELS: Record<string, string> = {
  adventure: "Adventure",
  thrills: "Thrills",
  family: "Family",
  romance: "Romance",
  team: "Team",
  nightlife: "Nightlife",
  workshop: "Workshop",
  markets: "Markets",
  digital: "Digital",
  "third-party": "Third Party",
};

/** Design-system activity colours — band accent follows the listing’s activity kind. */
const CATEGORY_COLOURS: Record<string, string> = {
  adventure: "#45A67F", // Jungle Jade
  thrills: "#FF9E6B", // Outrageous Orange
  family: "#DC729E", // Blissful Blush
  romance: "#D54732", // Passionate Pomegranate
  team: "#F3BF4A", // Cheerful Canary
  nightlife: "#5E589E", // Velvet Vibes
  workshop: "#FF2EFF", // Brainpower Pink
  markets: "#971A21", // Maroon Madness
  digital: "#7CC3E9", // Digital Sapphire
  "third-party": "#14001A", // Black Currant
};

const FALLBACK_ACCENT = "#45A67F"; // Jungle Jade

export const FALLBACK_EXPORT_IMAGE = "/brand/images/climbing.jpg";

function accentForActivityKind(key: string | null | undefined) {
  if (!key) return FALLBACK_ACCENT;
  return CATEGORY_COLOURS[key] ?? FALLBACK_ACCENT;
}

export type ExportFact = {
  icon: string;
  label: string;
  /** Longer copy (e.g. full street address) — allow wrap, slightly smaller type. */
  wrap?: boolean;
};

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
      tip: string | null;
      facts: ExportFact[];
      image: string;
      accent: string;
    };

export function areaFromListing(item: GuideDraftItem) {
  const listing = item.listing;
  if (!listing) return "South Africa";
  return [listing.suburb, listing.city].filter(Boolean).join(", ") || "South Africa";
}

/** Strip trailing SA postal codes so place lines stay clean. */
function cleanPlace(value: string) {
  return value.replace(/,?\s*\d{4}\s*$/, "").replace(/,$/, "").trim();
}

/** Shorter hero titles for long directory names (e.g. “CityROCK … - Indoor Climbing Gym”). */
export function shortExportName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 28) return trimmed;
  const head = trimmed.split(/\s+[–—-]\s+/)[0]?.trim() ?? trimmed;
  return head.length >= 8 ? head : trimmed;
}

function truncateCopy(value: string, max: number) {
  const text = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.([A-Za-z])/g, ". $1");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Prefer a short experience pitch over a full directory blurb. */
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

  // Keep to roughly one or two lines on the card.
  return truncateCopy(firstSentence, 96);
}

function formatExportPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return `FROM R${Math.round(n)}`;
}

function indoorOutdoorLabel(value: string | null | undefined) {
  if (value === "indoor") return "INDOOR";
  if (value === "outdoor") return "OUTDOOR";
  if (value === "both") return "INDOOR & OUTDOOR";
  return null;
}

function activityEmoji(key: string | null) {
  switch (key) {
    case "adventure":
      return "🧗";
    case "thrills":
      return "⚡";
    case "family":
      return "👨‍👩‍👧";
    case "romance":
      return "💛";
    case "team":
      return "🤝";
    case "nightlife":
      return "🌙";
    case "workshop":
      return "🛠️";
    case "markets":
      return "🛍️";
    case "digital":
      return "💻";
    default:
      return "✨";
  }
}

function indoorOutdoorEmoji(value: string | null) {
  if (value === "indoor") return "🏠";
  if (value === "outdoor") return "🌳";
  if (value === "both") return "🌤️";
  return "📍";
}

function tidyAddressPart(value: string | null | undefined) {
  return (value ?? "").trim().replace(/,+$/g, "").trim();
}

function splitPlaceAndPostal(value: string) {
  const match = value.match(/^(.*?),?\s*(\d{4})$/);
  if (!match) return { place: value, postal: "" };
  return {
    place: tidyAddressPart(match[1] ?? ""),
    postal: match[2] ?? "",
  };
}

function formatFullAddress(listing: GuideDraftItem["listing"]) {
  if (!listing) return "South Africa";

  const street1 = tidyAddressPart(listing.street_address_1);
  const street2 = tidyAddressPart(listing.street_address_2);
  const suburbRaw = tidyAddressPart(listing.suburb);
  const cityRaw = tidyAddressPart(listing.city);
  let postal = tidyAddressPart(listing.postal_code);

  const suburbSplit = splitPlaceAndPostal(suburbRaw);
  const citySplit = splitPlaceAndPostal(cityRaw);
  const suburb = suburbSplit.place;
  const city = citySplit.place;
  if (!postal) postal = citySplit.postal || suburbSplit.postal;

  const parts: string[] = [];
  const pushUnique = (value: string) => {
    if (!value) return;
    if (parts.some((part) => part.toLowerCase() === value.toLowerCase())) return;
    parts.push(value);
  };

  // Street address (line 1 + line 2), suburb, city, postal code — skip blanks/dupes.
  pushUnique(street1);
  pushUnique(street2);
  pushUnique(suburb);
  pushUnique(city);
  pushUnique(postal);

  return parts.length ? parts.join(", ") : "South Africa";
}

export function buildActivityFacts(item: GuideDraftItem): ExportFact[] {
  const listing = item.listing;
  const facts: ExportFact[] = [];

  facts.push({
    icon: "📍",
    label: formatFullAddress(listing),
    wrap: true,
  });

  const price = formatExportPrice(listing?.price_from ?? null);
  facts.push({ icon: "💰", label: price ?? "SEE DIRECTORY" });

  const kindKey = listing?.activity_kind_key ?? null;
  const kindTitle =
    listing?.activity_kind_title?.trim() ||
    (kindKey ? CATEGORY_LABELS[kindKey] ?? null : null);
  if (kindTitle) {
    facts.push({
      icon: activityEmoji(kindKey),
      label: kindTitle.toUpperCase(),
    });
  }

  const setting = indoorOutdoorLabel(listing?.indoor_outdoor ?? null);
  if (setting) {
    facts.push({
      icon: indoorOutdoorEmoji(listing?.indoor_outdoor ?? null),
      label: setting,
    });
  }

  if (listing?.booking_required) {
    facts.push({ icon: "📅", label: "BOOKING REQUIRED" });
  }

  if (kindKey === "family") {
    facts.push({ icon: "👟", label: "FAMILY FRIENDLY" });
  }

  // Keep the glanceable grid tight — four facts max.
  return facts.slice(0, 4);
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
      intro: input.intro.trim(),
      cover,
      spotCount: items.length,
    },
  ];

  items.forEach((item, index) => {
    const listing = item.listing;
    const tip = item.editorial_note.trim()
      ? truncateCopy(item.editorial_note, 110)
      : null;

    slides.push({
      kind: "activity",
      index: index + 1,
      spotCount: items.length,
      name: shortExportName(listing?.name ?? "Listing missing"),
      description: experienceDescription(item),
      tip,
      facts: buildActivityFacts(item),
      image: listing?.image ?? FALLBACK_EXPORT_IMAGE,
      accent: accentForActivityKind(listing?.activity_kind_key),
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
