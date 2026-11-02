import { authorSocialHref, type GuideAuthor } from "@/lib/guide-authors";
import type { GuideDraftItem, GuideListingPreview } from "@/lib/guide-shared";

export const IG_POST_WIDTH = 1080;
export const IG_POST_HEIGHT = 1350;
export const CAROUSEL_FOOTER = "@Discover_Venturo";
export const FALLBACK_EXPORT_IMAGE = "/brand/images/climbing.jpg";

export const CATEGORY_COLOURS: Record<string, string> = {
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

export const APPROVED_CATEGORIES = [
  { key: "adventure", title: "Adventure" },
  { key: "thrills", title: "Thrills" },
  { key: "family", title: "Family" },
  { key: "romance", title: "Romance" },
  { key: "team", title: "Team" },
  { key: "nightlife", title: "Nightlife" },
  { key: "workshop", title: "Workshop" },
  { key: "markets", title: "Markets" },
  { key: "digital", title: "Digital" },
] as const;

export const PRICE_BASES = ["adult", "person", "group", "hour", "varies", "free", "omit"] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];

export type CarouselCrop = { x: number; y: number; zoom: number };

export type CarouselFieldOverride<T> = {
  value: T;
  custom: boolean;
};

export type CarouselEventSource = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  city: string;
  image: string | null;
  fromPriceCents: number | null;
  priceMix: string;
};

export type CarouselCover = {
  seriesLabel: string;
  headline: string;
  supporting: string;
  geoLabel: string;
  dateFrom: string;
  dateTo: string;
  dateRange: string;
  swipePrompt: string;
  layout: "hero" | "collage";
  image: string;
  collage: [string, string, string];
  collageCrops: [CarouselCrop, CarouselCrop, CarouselCrop];
  crop: CarouselCrop;
};

export type CarouselRec = {
  id: string;
  sourceId: string;
  kind: "activity" | "event";
  title: string;
  description: string;
  location: string;
  categoryKey: string;
  categoryTitle: string;
  priceAmount: number | null;
  priceBasis: PriceBasis;
  priceNote: string;
  tip: string;
  image: string;
  photos: string[];
  crop: CarouselCrop;
  eventDate: string;
  eventStart: string;
  eventEnd: string;
  availabilityChecked: boolean;
  custom: Partial<Record<keyof Omit<CarouselRec, "id" | "sourceId" | "kind" | "photos" | "custom">, boolean>>;
};

export type CarouselAuthor = {
  sourceId: string;
  name: string;
  bio: string;
  photo: string;
  cover: string;
  handle: string;
  kicker: string;
  closing: string;
  primaryAction: string;
  supportingAction: string;
  compactLayout: boolean;
};

export type CarouselDraft = {
  version: 1;
  cover: CarouselCover;
  recs: CarouselRec[];
  author: CarouselAuthor;
  acknowledged: string[];
};

export type CarouselIssue = {
  id: string;
  level: "error" | "warn";
  slide: "cover" | "author" | string;
  field?: string;
  message: string;
  hint?: string;
};

const DEFAULT_CROP: CarouselCrop = { x: 50, y: 50, zoom: 1 };

function friendlyCity(value: string) {
  if (/^johannesburg$/i.test(value.trim())) return "Joburg";
  return value.trim();
}

export function completeSentence(raw: string) {
  const text = raw.trim().replace(/\s+/g, " ").replace(/\.([A-Za-z])/g, ". $1");
  if (!text) return "";
  const match = text.match(/^.+?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}

export function stripLeadingName(sentence: string, name: string) {
  const trimmed = sentence.trim();
  if (!name.trim()) return trimmed;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}\\s+(is|gives|offers|brings|takes)\\s+(?:you\\s+)?`, "i");
  const stripped = trimmed.replace(re, "");
  if (stripped === trimmed) return trimmed;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function formatRand(amount: number) {
  return `R${Math.round(amount)}`;
}

export function formatSocialPrice(amount: number | null, basis: PriceBasis, note: string) {
  if (basis === "omit") return "";
  if (basis === "free") return "Free entry";
  if (basis === "varies") return "Varies by activity";
  if (amount == null) return "";
  const labels: Record<Exclude<PriceBasis, "varies" | "free" | "omit">, string> = {
    adult: "per adult",
    person: "per person",
    group: "per group",
    hour: "per hour",
  };
  const basisLabel = labels[basis];
  const main = `From ${formatRand(amount)}${basisLabel ? ` ${basisLabel}` : ""}`;
  return note.trim() ? `${main} · ${note.trim()}` : main;
}

export function accentForCategory(key: string) {
  return CATEGORY_COLOURS[key] ?? "#45A67F";
}

export function inkForAccent(accent: string): "night" | "snow" {
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

export function instagramHandle(raw: string | null | undefined) {
  const href = authorSocialHref(raw, "instagram");
  if (!href) return "";
  const match = href.match(/instagram\.com\/([^/?#]+)/i);
  const handle = (match?.[1] ?? "").replace(/^@/, "");
  return handle ? `@${handle}` : "";
}

function areaFromListing(listing: GuideListingPreview | null) {
  if (!listing) return "";
  const suburb = (listing.suburb ?? "").trim();
  const city = friendlyCity(listing.city ?? "");
  return [suburb, city].filter(Boolean).join(", ");
}

function photosFromListing(listing: GuideListingPreview | null) {
  const urls = [...(listing?.images ?? []), listing?.image ?? ""].filter(Boolean) as string[];
  return [...new Set(urls)];
}

export function defaultSocialDescription(listing: GuideListingPreview | null) {
  const name = listing?.name ?? "";
  const sentence = completeSentence(listing?.short_description ?? "");
  return stripLeadingName(sentence, name);
}

export function isWeekendGuide(title: string, seriesLabel: string) {
  return /weekend/i.test(`${title} ${seriesLabel}`);
}

export function padRecIndex(index: number, total: number) {
  return `${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
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

function seedRecFromListing(item: GuideDraftItem): CarouselRec {
  const listing = item.listing;
  const photos = photosFromListing(listing);
  const image = photos[0] ?? FALLBACK_EXPORT_IMAGE;
  const amountRaw = listing?.price_from;
  const amount =
    amountRaw == null || amountRaw === ""
      ? null
      : typeof amountRaw === "number"
        ? amountRaw
        : Number(amountRaw);
  const priceAmount = amount != null && Number.isFinite(amount) ? amount : null;
  const key = listing?.activity_kind_key ?? "adventure";
  const title = (listing?.activity_kind_title ?? "").trim();
  return {
    id: item.listing_id,
    sourceId: item.listing_id,
    kind: "activity",
    title: (listing?.name ?? "Listing missing").trim(),
    description: defaultSocialDescription(listing),
    location: areaFromListing(listing),
    categoryKey: key,
    categoryTitle: title || "Adventure",
    priceAmount,
    priceBasis: priceAmount == null ? "omit" : priceAmount === 0 ? "free" : "adult",
    priceNote: "",
    tip: listing?.booking_required ? "Booking required." : "",
    image,
    photos,
    crop: { ...DEFAULT_CROP },
    eventDate: "",
    eventStart: "",
    eventEnd: "",
    availabilityChecked: false,
    custom: {},
  };
}

export function seedRecFromEvent(event: CarouselEventSource): CarouselRec {
  const image = event.image || FALLBACK_EXPORT_IMAGE;
  const amount = event.fromPriceCents == null ? null : event.fromPriceCents / 100;
  const start = event.startsAt ? new Date(event.startsAt) : null;
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const date = start && !Number.isNaN(start.getTime())
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(start)
    : "";
  const time = (iso: Date | null) =>
    iso && !Number.isNaN(iso.getTime())
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Johannesburg",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(iso)
      : "";
  return {
    id: `event-${event.id}`,
    sourceId: event.id,
    kind: "event",
    title: event.title.trim(),
    description: completeSentence(event.description),
    location: [event.venueName, friendlyCity(event.city)].filter(Boolean).join(", "),
    categoryKey: "family",
    categoryTitle: "Family",
    priceAmount: amount,
    priceBasis: event.priceMix === "free" ? "free" : amount == null ? "omit" : "person",
    priceNote: "",
    tip: "",
    image,
    photos: [image],
    crop: { ...DEFAULT_CROP },
    eventDate: date,
    eventStart: time(start),
    eventEnd: time(end),
    availabilityChecked: false,
    custom: {},
  };
}

function seedCover(title: string, intro: string, recs: CarouselRec[], place: string): CarouselCover {
  const images = recs.map((rec) => rec.image).filter(Boolean);
  const hero = images[0] ?? FALLBACK_EXPORT_IMAGE;
  const count = recs.length;
  const weekend = isWeekendGuide(title, "Weekend Guide");
  return {
    seriesLabel: weekend ? "Weekend Guide" : "Venturo Guide",
    headline: count ? `${count} Weekend\nAdventures` : title.trim() || "Your Next Adventure",
    supporting: intro.trim() ? completeSentence(intro) : "Pick a spot. Rally your people.",
    geoLabel: place || "Joburg & nearby",
    dateFrom: "",
    dateTo: "",
    dateRange: "",
    swipePrompt: "Swipe to find your next adventure →",
    layout: images.length >= 3 ? "collage" : "hero",
    image: hero,
    collage: [images[0] ?? hero, images[1] ?? hero, images[2] ?? hero],
    collageCrops: [{ ...DEFAULT_CROP }, { ...DEFAULT_CROP }, { ...DEFAULT_CROP }],
    crop: { ...DEFAULT_CROP },
  };
}

function seedAuthor(author: GuideAuthor | null): CarouselAuthor {
  const name = author?.display_name.trim() || "";
  const handle = instagramHandle(author?.instagram_url);
  return {
    sourceId: author?.id ?? "",
    name,
    bio: completeSentence(author?.tagline || author?.bio || ""),
    photo: (author?.photo_url || "").trim(),
    cover: (author?.cover_url || "").trim(),
    handle,
    kicker: "Meet your guide",
    closing: "Your Next Plan Starts Here.",
    primaryAction: "Save this guide for the weekend.",
    supportingAction: "Full guide via the link in our bio.",
    compactLayout: false,
  };
}

function isPlaceholderAuthor(author: CarouselAuthor) {
  const name = author.name.trim();
  return !name || /^untitled author$/i.test(name) || /^assign an author$/i.test(name);
}

function mergeAuthor(saved: CarouselAuthor | undefined, seed: CarouselAuthor): CarouselAuthor {
  if (!saved) return seed;
  const samePerson = Boolean(seed.sourceId) && saved.sourceId === seed.sourceId;
  if (!samePerson || isPlaceholderAuthor(saved)) {
    return {
      ...seed,
      compactLayout: samePerson ? Boolean(saved.compactLayout) : false,
    };
  }
  return {
    ...seed,
    bio: saved.bio.trim() ? saved.bio : seed.bio,
    photo: seed.photo,
    cover: seed.cover,
    kicker: saved.kicker || seed.kicker,
    closing: saved.closing || seed.closing,
    primaryAction: saved.primaryAction || seed.primaryAction,
    supportingAction: saved.supportingAction || seed.supportingAction,
    compactLayout: saved.compactLayout ?? false,
  };
}

export function seedCarouselDraft(input: {
  title: string;
  intro: string;
  items: GuideDraftItem[];
  author: GuideAuthor | null;
  place?: string;
}): CarouselDraft {
  const recs = input.items.map(seedRecFromListing);
  return {
    version: 1,
    cover: seedCover(input.title, input.intro, recs, input.place ?? ""),
    recs,
    author: seedAuthor(input.author),
    acknowledged: [],
  };
}

export function mergeCarouselDraft(saved: CarouselDraft | null | undefined, seed: CarouselDraft): CarouselDraft {
  if (!saved || saved.version !== 1) return seed;
  const recs = seed.recs.map((fresh) => {
    const prev = saved.recs.find((row) => row.id === fresh.id || row.sourceId === fresh.sourceId);
    if (!prev) return fresh;
    const custom = prev.custom ?? {};
    return {
      ...fresh,
      title: custom.title ? prev.title : fresh.title,
      description: custom.description ? prev.description : fresh.description,
      location: custom.location ? prev.location : fresh.location,
      categoryKey: custom.categoryKey ? prev.categoryKey : fresh.categoryKey,
      categoryTitle: custom.categoryTitle ? prev.categoryTitle : fresh.categoryTitle,
      priceAmount: custom.priceAmount ? prev.priceAmount : fresh.priceAmount,
      priceBasis: custom.priceBasis ? prev.priceBasis : fresh.priceBasis,
      priceNote: custom.priceNote ? prev.priceNote : fresh.priceNote,
      tip: custom.tip ? prev.tip : fresh.tip,
      image: custom.image ? prev.image : fresh.image,
      crop: prev.crop ?? fresh.crop,
      eventDate: custom.eventDate ? prev.eventDate : fresh.eventDate,
      eventStart: custom.eventStart ? prev.eventStart : fresh.eventStart,
      eventEnd: custom.eventEnd ? prev.eventEnd : fresh.eventEnd,
      availabilityChecked: prev.availabilityChecked,
      photos: [...new Set([...fresh.photos, ...prev.photos])],
      custom,
    };
  });
  const extra = saved.recs.filter((row) => row.kind === "event" && !recs.some((item) => item.sourceId === row.sourceId));
  return {
    version: 1,
    cover: {
      ...seed.cover,
      ...saved.cover,
      collage: saved.cover.collage ?? seed.cover.collage,
      collageCrops: saved.cover.collageCrops ?? seed.cover.collageCrops,
      crop: saved.cover.crop ?? seed.cover.crop,
      dateFrom: saved.cover.dateFrom || datesFromRange(saved.cover.dateRange).from,
      dateTo: saved.cover.dateTo || datesFromRange(saved.cover.dateRange).to,
    },
    recs: [...recs, ...extra],
    author: mergeAuthor(saved.author, seed.author),
    acknowledged: saved.acknowledged ?? [],
  };
}

export function parseCarouselDraft(value: unknown): CarouselDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as CarouselDraft;
  if (row.version !== 1 || !row.cover || !Array.isArray(row.recs) || !row.author) return null;
  return row;
}

export function validateCarousel(draft: CarouselDraft, overflowIds: string[] = []): CarouselIssue[] {
  const issues: CarouselIssue[] = [];
  const weekend = isWeekendGuide(draft.cover.headline, draft.cover.seriesLabel);
  if (!draft.cover.headline.trim()) {
    issues.push({ id: "cover-headline", level: "error", slide: "cover", message: "Cover needs a headline." });
  }
  if (!draft.cover.image) {
    issues.push({ id: "cover-photo", level: "error", slide: "cover", message: "Cover needs a photograph." });
  }
  if (weekend && !draft.cover.dateFrom) {
    issues.push({
      id: "cover-dates",
      level: "error",
      slide: "cover",
      field: "dateFrom",
      message: "Pick the weekend this carousel is for.",
      hint: "These dates print on the cover. They are not the website publish dates.",
    });
  }
  if (/south africa|^joburg$|^johannesburg$/i.test(draft.cover.geoLabel.trim())) {
    issues.push({ id: "cover-geo", level: "warn", slide: "cover", message: "Cover location is broad. Add a suburb or area if you can." });
  }
  if (draft.recs[0] && draft.cover.layout === "hero" && draft.cover.image === draft.recs[0].image) {
    issues.push({ id: "cover-dup", level: "warn", slide: "cover", message: "Cover uses the same photograph as the first recommendation." });
  }
  if (!draft.author.name.trim()) {
    issues.push({ id: "author-missing", level: "error", slide: "author", field: "name", message: "Assign an author before export." });
  }
  if (draft.author.name && !draft.author.photo && !draft.author.compactLayout) {
    issues.push({
      id: "author-photo",
      level: "error",
      slide: "author",
      field: "photo",
      message: "Author portrait is missing.",
      hint: "Add a photo on the author profile, or use the compact layout.",
    });
  }
  if (draft.author.name && !draft.author.bio.trim()) {
    issues.push({
      id: "author-bio",
      level: "error",
      slide: "author",
      field: "bio",
      message: "Write a one-sentence social bio for the closing slide.",
    });
  }
  draft.recs.forEach((rec, index) => {
    const slide = rec.id;
    const label = rec.title || `Recommendation ${index + 1}`;
    if (!rec.title.trim()) {
      issues.push({ id: `${slide}-title`, level: "error", slide, message: `${label} needs a title.` });
    }
    if (!rec.image) {
      issues.push({ id: `${slide}-photo`, level: "error", slide, message: `${label} needs a photograph.` });
    }
    if (!rec.description.trim()) {
      issues.push({ id: `${slide}-copy`, level: "error", slide, message: `${label} needs a complete social description.` });
    }
    const words = wordCount(rec.description);
    if (words && (words < 8 || words > 32)) {
      issues.push({
        id: `${slide}-words`,
        level: "warn",
        slide,
        message: `${label} description is ${words} words. Aim for 15–25.`,
      });
    }
    if (rec.priceAmount == null && rec.priceBasis !== "omit" && rec.priceBasis !== "free" && rec.priceBasis !== "varies") {
      issues.push({ id: `${slide}-price`, level: "warn", slide, message: `${label} is missing a verified price.` });
    }
    if (!rec.location.trim() || /^south africa$/i.test(rec.location)) {
      issues.push({ id: `${slide}-place`, level: "warn", slide, message: `${label} needs a suburb or area.` });
    }
    if (rec.kind === "event" && !rec.eventDate) {
      issues.push({ id: `${slide}-date`, level: "error", slide, message: `${label} needs an event date.` });
    }
    if (rec.kind === "event" && rec.eventDate && rec.eventDate < todayZa()) {
      issues.push({ id: `${slide}-expired`, level: "error", slide, message: `${label} has already happened.` });
    }
    if (rec.kind === "event" && rec.eventDate && weekend && outsideWeekend(rec.eventDate, draft.cover.dateFrom, draft.cover.dateTo)) {
      issues.push({
        id: `${slide}-weekend`,
        level: "warn",
        slide,
        message: `${label} falls outside this guide’s weekend dates.`,
      });
    }
    if (rec.kind === "activity" && weekend && !rec.availabilityChecked) {
      issues.push({
        id: `${slide}-avail`,
        level: "warn",
        slide,
        field: "availabilityChecked",
        message: `Confirm ${label} is available this weekend.`,
      });
    }
  });
  overflowIds.forEach((id) => {
    const [slide, field] = id.split("::");
    const labels: Record<string, string> = {
      headline: "The cover headline",
      description: "This description",
    };
    issues.push({
      id: `${slide}-overflow-${field || "copy"}`,
      level: "error",
      slide,
      field: field || undefined,
      message: `${labels[field] ?? "Text"} is clipped. Shorten it a little so the full sentence shows.`,
    });
  });
  return issues;
}

function todayZa() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
}

function datesFromRange(range: string | undefined) {
  const dates = range?.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  return { from: dates[0] ?? "", to: dates[1] ?? dates[0] ?? "" };
}

function outsideWeekend(eventDate: string, from: string, to: string) {
  if (!from) return false;
  const end = to || from;
  return eventDate < from || eventDate > end;
}

export function defaultCrop(): CarouselCrop {
  return { ...DEFAULT_CROP };
}

export function formatCoverDates(from: string, to: string) {
  if (!from) return "";
  const start = new Date(`${from}T12:00:00+02:00`);
  const end = new Date(`${(to || from)}T12:00:00+02:00`);
  if (Number.isNaN(start.getTime())) return from;
  const day = new Intl.DateTimeFormat("en-ZA", { day: "numeric", timeZone: "Africa/Johannesburg" });
  const month = new Intl.DateTimeFormat("en-ZA", { month: "short", timeZone: "Africa/Johannesburg" });
  if (!to || from === to) return `${day.format(start)} ${month.format(start)}`;
  if (start.getMonth() === end.getMonth()) return `${day.format(start)}–${day.format(end)} ${month.format(end)}`;
  return `${day.format(start)} ${month.format(start)} – ${day.format(end)} ${month.format(end)}`;
}

export function mapEventSource(event: {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  city: string | null;
  bannerUrl?: string | null;
  listingImageUrl?: string | null;
  fromPriceCents: number | null;
  priceMix: string;
}): CarouselEventSource {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venueName: event.venueName,
    city: event.city ?? "",
    image: event.bannerUrl || event.listingImageUrl || null,
    fromPriceCents: event.fromPriceCents,
    priceMix: event.priceMix,
  };
}

export function cropStyle(crop: CarouselCrop) {
  const zoom = Math.max(1, crop.zoom);
  return {
    objectPosition: `${crop.x}% ${crop.y}%`,
    transform: `scale(${zoom})`,
    transformOrigin: `${crop.x}% ${crop.y}%`,
  };
}
