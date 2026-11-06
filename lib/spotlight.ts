import { formatDay, formatHours } from "@/lib/control-room-shared";

export const SPOTLIGHT_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "photo",
  "pair",
  "gallery",
  "quote",
  "tip",
] as const;

export type SpotlightBlockType = (typeof SPOTLIGHT_BLOCK_TYPES)[number];

export type SpotlightBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "photo"; photoId: string }
  | { id: string; type: "pair"; photoIds: [string, string] }
  | { id: string; type: "gallery"; photoIds: string[] }
  | { id: string; type: "quote"; text: string }
  | { id: string; type: "tip"; text: string };

export const STORY_SECTION_TYPES = ["story", "photos", "tip", "quote"] as const;
export type StorySectionType = (typeof STORY_SECTION_TYPES)[number];

export const PHOTO_LAYOUTS = ["none", "one", "two", "gallery"] as const;
export type PhotoLayout = (typeof PHOTO_LAYOUTS)[number];

export type SpotlightPlacement = {
  id: string;
  photoId: string;
  caption: string;
  credit: string;
  alt: string;
  focusX: number;
  focusY: number;
};

export type SpotlightSection = {
  id: string;
  type: StorySectionType;
  heading: string;
  bodyHtml: string;
  text: string;
  attribution: string;
  layout: PhotoLayout;
  placements: SpotlightPlacement[];
};

export type SpotlightPhoto = {
  id: string;
  source: "listing" | "upload";
  listingMediaId: string | null;
  url: string;
  alt: string;
  caption: string;
  credit: string;
  cover: boolean;
  gallery: boolean;
  instagram: boolean;
  focusX: number;
  focusY: number;
};

export type SpotlightCover = {
  photoId: string | null;
  focusX: number;
  focusY: number;
  textAlign: "left" | "center";
};

export type SpotlightVisitInfo = {
  name: string;
  slug: string;
  area: string;
  fromPrice: number | null;
  bookingUrl: string | null;
  websiteUrl: string | null;
  phone: string | null;
  bookingRequired: boolean;
  indoorOutdoor: string | null;
  hours: { dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }[];
};

export type SpotlightListingMedia = {
  id: string;
  url: string;
  alt: string | null;
  isCover: boolean;
};

export function newSpotlightId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function emptySpotlightCover(): SpotlightCover {
  return { photoId: null, focusX: 50, focusY: 42, textAlign: "left" };
}

export function parseSpotlightStory(raw: unknown): SpotlightSection[] {
  if (!Array.isArray(raw)) return [];
  const looksNew = raw.some((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as { type?: string; placements?: unknown };
    return row.type === "story" || row.type === "photos" || Array.isArray(row.placements);
  });
  if (looksNew) return raw.flatMap((item) => parseSection(item));
  return migrateLegacyBlocks(raw);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parsePlacement(raw: unknown): SpotlightPlacement | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const photoId = asString(row.photoId);
  if (!photoId) return null;
  return {
    id: asString(row.id) || newSpotlightId(),
    photoId,
    caption: asString(row.caption),
    credit: asString(row.credit),
    alt: asString(row.alt),
    focusX: Number.isFinite(Number(row.focusX)) ? Number(row.focusX) : 50,
    focusY: Number.isFinite(Number(row.focusY)) ? Number(row.focusY) : 50,
  };
}

function parseLayout(value: unknown, fallback: PhotoLayout = "none"): PhotoLayout {
  return PHOTO_LAYOUTS.includes(value as PhotoLayout) ? (value as PhotoLayout) : fallback;
}

function parseSection(raw: unknown): SpotlightSection[] {
  if (!raw || typeof raw !== "object") return [];
  const row = raw as Record<string, unknown>;
  const type = row.type;
  if (!STORY_SECTION_TYPES.includes(type as StorySectionType)) return [];
  const placements = Array.isArray(row.placements)
    ? row.placements.flatMap((item) => {
        const placement = parsePlacement(item);
        return placement ? [placement] : [];
      })
    : [];
  return [
    {
      id: asString(row.id) || newSpotlightId(),
      type: type as StorySectionType,
      heading: asString(row.heading),
      bodyHtml: sanitizeStoryHtml(asString(row.bodyHtml)),
      text: asString(row.text),
      attribution: asString(row.attribution),
      layout: parseLayout(row.layout, type === "photos" ? "one" : "none"),
      placements,
    },
  ];
}

function placementsFromIds(ids: string[]): SpotlightPlacement[] {
  return ids.filter(Boolean).map((photoId) => emptyPlacement(photoId));
}

function migrateLegacyBlocks(raw: unknown[]): SpotlightSection[] {
  const sections: SpotlightSection[] = [];
  let pending: SpotlightSection | null = null;
  const flush = () => {
    if (pending) sections.push(pending);
    pending = null;
  };
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const type = row.type;
    const id = asString(row.id) || newSpotlightId();
    const text = asString(row.text);
    if (type === "heading") {
      flush();
      pending = emptySection("story", id);
      pending.heading = text;
    } else if (type === "paragraph") {
      const html = text ? `<p>${escapeHtml(text)}</p>` : "";
      if (pending?.type === "story") pending.bodyHtml += html;
      else {
        flush();
        pending = emptySection("story", id);
        pending.bodyHtml = html;
      }
    } else if (type === "quote") {
      flush();
      const section = emptySection("quote", id);
      section.text = text;
      sections.push(section);
    } else if (type === "tip") {
      flush();
      const section = emptySection("tip", id);
      section.text = text;
      sections.push(section);
    } else if (type === "photo") {
      flush();
      const section = emptySection("photos", id);
      section.layout = "one";
      section.placements = placementsFromIds([asString(row.photoId)]);
      sections.push(section);
    } else if (type === "pair") {
      flush();
      const ids = Array.isArray(row.photoIds) ? row.photoIds.filter((value): value is string => typeof value === "string") : [];
      const section = emptySection("photos", id);
      section.layout = "two";
      section.placements = placementsFromIds([ids[0] ?? "", ids[1] ?? ""]);
      sections.push(section);
    } else if (type === "gallery") {
      flush();
      const ids = Array.isArray(row.photoIds) ? row.photoIds.filter((value): value is string => typeof value === "string") : [];
      const section = emptySection("photos", id);
      section.layout = "gallery";
      section.placements = placementsFromIds(ids);
      sections.push(section);
    }
  }
  flush();
  return sections;
}

export function emptyPlacement(photoId = ""): SpotlightPlacement {
  return {
    id: newSpotlightId(),
    photoId,
    caption: "",
    credit: "",
    alt: "",
    focusX: 50,
    focusY: 50,
  };
}

export function emptySection(type: StorySectionType, id = newSpotlightId()): SpotlightSection {
  return {
    id,
    type,
    heading: "",
    bodyHtml: "",
    text: "",
    attribution: "",
    layout: type === "photos" ? "one" : "none",
    placements: type === "photos" ? [emptyPlacement()] : [],
  };
}

export function cloneSection(section: SpotlightSection): SpotlightSection {
  return {
    ...section,
    placements: section.placements.map((placement) => ({ ...placement })),
  };
}

export function storySectionLabel(type: StorySectionType) {
  if (type === "story") return "Story section";
  if (type === "photos") return "Photos";
  if (type === "tip") return "Author’s tip";
  return "Quote";
}

export function photoLayoutLabel(layout: PhotoLayout) {
  if (layout === "none") return "None";
  if (layout === "one") return "One photo";
  if (layout === "two") return "Two photos";
  return "Gallery";
}

export function layoutSlotCount(layout: PhotoLayout) {
  if (layout === "none") return 0;
  if (layout === "one") return 1;
  if (layout === "two") return 2;
  return null;
}

export function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|h\d|div)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sanitizeStoryHtml(html: string) {
  const withoutScripts = html.replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "").replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return withoutScripts.replace(/javascript:/gi, "");
}

export function sectionIsEmpty(section: SpotlightSection) {
  const hasText =
    section.heading.trim() ||
    htmlToPlainText(section.bodyHtml) ||
    section.text.trim() ||
    section.attribution.trim();
  const hasPhotos = section.placements.some((placement) => placement.photoId);
  return !hasText && !hasPhotos;
}

export function sectionValidation(section: SpotlightSection) {
  const errors: { field: "body" | "photos" | "layout"; message: string }[] = [];
  if (sectionIsEmpty(section)) {
    errors.push({ field: "body", message: "Add writing or photos before saving this section." });
  }
  const filled = section.placements.filter((placement) => placement.photoId);
  if (section.layout === "one" && filled.length < 1) {
    errors.push({ field: "photos", message: "Choose one photo for this layout." });
  }
  if (section.layout === "two" && filled.length < 2) {
    errors.push({ field: "photos", message: "Choose a left photo & a right photo." });
  }
  if (section.layout === "gallery" && filled.length < 2) {
    errors.push({ field: "photos", message: "Choose at least two photos for a gallery." });
  }
  if (section.type === "quote" && !section.text.trim()) {
    errors.push({ field: "body", message: "Add the quote before saving." });
  }
  if (section.type === "tip" && !section.text.trim()) {
    errors.push({ field: "body", message: "Add the tip before saving." });
  }
  return errors;
}

export function photoUsageLabels(
  photoId: string,
  sections: SpotlightSection[],
  cover: SpotlightCover,
) {
  const uses: string[] = [];
  if (cover.photoId === photoId) uses.push("Cover");
  sections.forEach((section, index) => {
    if (section.placements.some((placement) => placement.photoId === photoId)) {
      uses.push(`Section ${index + 1}`);
    }
  });
  return uses;
}

export function parseSpotlightPhotos(raw: unknown): SpotlightPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const url = typeof row.url === "string" ? row.url : "";
    if (!url) return [];
    return [
      {
        id: typeof row.id === "string" && row.id ? row.id : newSpotlightId(),
        source: row.source === "upload" ? "upload" : "listing",
        listingMediaId: typeof row.listingMediaId === "string" ? row.listingMediaId : null,
        url,
        alt: typeof row.alt === "string" ? row.alt : "",
        caption: typeof row.caption === "string" ? row.caption : "",
        credit: typeof row.credit === "string" ? row.credit : "",
        cover: Boolean(row.cover),
        gallery: Boolean(row.gallery),
        instagram: Boolean(row.instagram),
        focusX: Number.isFinite(Number(row.focusX)) ? Number(row.focusX) : 50,
        focusY: Number.isFinite(Number(row.focusY)) ? Number(row.focusY) : 50,
      },
    ];
  });
}

export function parseSpotlightCover(raw: unknown): SpotlightCover {
  if (!raw || typeof raw !== "object") return emptySpotlightCover();
  const row = raw as Record<string, unknown>;
  return {
    photoId: typeof row.photoId === "string" ? row.photoId : null,
    focusX: Number.isFinite(Number(row.focusX)) ? Number(row.focusX) : 50,
    focusY: Number.isFinite(Number(row.focusY)) ? Number(row.focusY) : 42,
    textAlign: row.textAlign === "center" ? "center" : "left",
  };
}

export function photoById(photos: SpotlightPhoto[], id: string | null | undefined) {
  if (!id) return null;
  return photos.find((photo) => photo.id === id) ?? null;
}

export function coverPhoto(photos: SpotlightPhoto[], cover: SpotlightCover) {
  return photoById(photos, cover.photoId) ?? photos.find((photo) => photo.cover) ?? null;
}

export function galleryPhotos(photos: SpotlightPhoto[]) {
  return photos.filter((photo) => photo.gallery);
}

export function instagramPhotos(photos: SpotlightPhoto[]) {
  return photos.filter((photo) => photo.instagram);
}

export function photoPlacements(photo: SpotlightPhoto, cover: SpotlightCover) {
  const uses: string[] = [];
  if (cover.photoId === photo.id || photo.cover) uses.push("Cover");
  if (photo.gallery) uses.push("Gallery");
  if (photo.instagram) uses.push("Instagram");
  return uses;
}

function usablePhotoUrl(url: string) {
  return Boolean(url) && !/\/listing-media\/?$/.test(url);
}

export function mergeListingPhotos(existing: SpotlightPhoto[], media: SpotlightListingMedia[]): SpotlightPhoto[] {
  const byMedia = new Map(
    existing.filter((photo) => photo.listingMediaId).map((photo) => [photo.listingMediaId as string, photo]),
  );
  const byUrl = new Map(existing.map((photo) => [photo.url, photo]));
  const next = [...existing];
  for (const item of media) {
    if (!usablePhotoUrl(item.url)) continue;
    if (byMedia.has(item.id) || byUrl.has(item.url)) continue;
    next.push({
      id: newSpotlightId(),
      source: "listing",
      listingMediaId: item.id,
      url: item.url,
      alt: item.alt ?? "",
      caption: "",
      credit: "",
      cover: false,
      gallery: false,
      instagram: false,
      focusX: 50,
      focusY: 50,
    });
  }
  return next;
}

/** Keep uploads; swap listing-sourced photos when the linked activity changes. */
export function replaceListingPhotos(existing: SpotlightPhoto[], media: SpotlightListingMedia[]): SpotlightPhoto[] {
  const allowed = new Set(media.map((item) => item.id));
  const kept = existing.filter((photo) => {
    if (!usablePhotoUrl(photo.url)) return false;
    if (photo.source === "upload" && !photo.listingMediaId) return true;
    return Boolean(photo.listingMediaId && allowed.has(photo.listingMediaId));
  });
  return mergeListingPhotos(kept, media);
}

export function pruneStoryPhotos(story: SpotlightSection[], photos: SpotlightPhoto[]): SpotlightSection[] {
  const ids = new Set(photos.map((photo) => photo.id));
  return story.map((section) => {
    const placements = section.placements.filter((row) => ids.has(row.photoId));
    let layout = section.layout;
    if (placements.length === 0) layout = "none";
    else if (placements.length === 1) layout = "one";
    else if (placements.length === 2 && layout === "gallery") layout = "two";
    return { ...section, placements, layout };
  });
}

export function estimateReadMinutes(intro: string, story: SpotlightSection[]) {
  const words = [
    intro,
    ...story.map((section) =>
      [section.heading, htmlToPlainText(section.bodyHtml), section.text, section.attribution].join(" "),
    ),
  ]
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 180) || 1);
}

export function spotlightBlockLabel(type: SpotlightBlockType) {
  if (type === "heading") return "Section heading";
  if (type === "paragraph") return "Paragraph";
  if (type === "photo") return "Full-width photo";
  if (type === "pair") return "Two photos side by side";
  if (type === "gallery") return "Photo gallery";
  if (type === "quote") return "Highlighted quote";
  return "Author’s tip";
}

export function createSpotlightBlock(type: SpotlightBlockType): SpotlightBlock {
  const id = newSpotlightId();
  if (type === "heading" || type === "paragraph" || type === "quote" || type === "tip") {
    return { id, type, text: "" };
  }
  if (type === "photo") return { id, type, photoId: "" };
  if (type === "pair") return { id, type, photoIds: ["", ""] };
  return { id, type, photoIds: [] };
}

export function spotlightPriceLabel(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "Price to follow";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "Price to follow";
  if (amount === 0) return "Free";
  return `From R ${amount.toFixed(2)}`;
}

export function groupSpotlightHours(hours: SpotlightVisitInfo["hours"]) {
  const week = hours
    .filter((row) => row.dayOfWeek >= 1 && row.dayOfWeek <= 7)
    .filter((row) => row.opensAt || row.closesAt || row.isClosed)
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const groups: { from: number; to: number; time: string }[] = [];
  for (const row of week) {
    const time = formatHours(row.opensAt, row.closesAt, row.isClosed);
    const last = groups[groups.length - 1];
    if (last && last.to === row.dayOfWeek - 1 && last.time === time) {
      last.to = row.dayOfWeek;
      continue;
    }
    groups.push({ from: row.dayOfWeek, to: row.dayOfWeek, time });
  }

  const lines = groups.map((group) => ({
    days: group.from === group.to ? formatDay(group.from) : `${formatDay(group.from)} – ${formatDay(group.to)}`,
    time: group.time,
  }));

  const holiday = hours.find((row) => row.dayOfWeek === 8 && (row.opensAt || row.closesAt || row.isClosed));
  if (holiday) {
    lines.push({
      days: formatDay(8),
      time: formatHours(holiday.opensAt, holiday.closesAt, holiday.isClosed),
    });
  }

  return lines;
}

export function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}
