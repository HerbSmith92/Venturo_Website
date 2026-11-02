import type { SpotlightListingDetails } from "@/lib/control-room-guides";
import type { GuideAuthor } from "@/lib/guide-authors";
import {
  FALLBACK_EXPORT_IMAGE,
  completeSentence,
  seedCarouselDraft,
  wordCount,
  type CarouselDraft,
  type CarouselRec,
} from "@/lib/guide-carousel";
import {
  coverPhoto,
  htmlToPlainText,
  photoById,
  type SpotlightCover,
  type SpotlightPhoto,
  type SpotlightSection,
} from "@/lib/spotlight";

const DEFAULT_CROP = { x: 50, y: 50, zoom: 1 };

function socialExcerpt(raw: string, maxWords = 28) {
  const sentence = completeSentence(raw);
  const words = sentence.trim() ? sentence.trim().split(/\s+/) : [];
  if (words.length <= maxWords) return sentence;
  return `${words.slice(0, maxWords - 2).join(" ").replace(/[,:;]$/, "")}.`;
}

function recShell(
  partial: Pick<CarouselRec, "id" | "sourceId" | "title" | "description" | "location" | "image" | "photos"> & Partial<CarouselRec>,
): CarouselRec {
  return {
    kind: "activity",
    categoryKey: "adventure",
    categoryTitle: "Adventure",
    priceAmount: null,
    priceBasis: "omit",
    priceNote: "",
    tip: "",
    role: "story",
    crop: { ...DEFAULT_CROP },
    eventDate: "",
    eventStart: "",
    eventEnd: "",
    availabilityChecked: true,
    custom: {},
    ...partial,
  };
}

function punchyHeadline(intro: string) {
  const introLine = completeSentence(intro);
  if (introLine && wordCount(introLine) <= 8 && !introLine.includes(":")) return introLine;
  return "A little wild. A lot of peace.";
}

function geoLine(area: string) {
  const place = area.trim();
  if (!place) return "";
  if (/^near /i.test(place)) return place.endsWith(".") ? place : `${place}.`;
  return `Near ${place}.`;
}

function foldName(value: string) {
  return value.replace(/['’]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isPackSection(section: SpotlightSection) {
  const hay = foldName(`${section.heading} ${section.text} ${htmlToPlainText(section.bodyHtml)}`);
  return /before you go|before you set|pack for|what to bring|walking shoes|sun protection/.test(hay);
}

function sectionHeading(section: SpotlightSection) {
  if (section.heading.trim()) return section.heading.trim();
  const fromHtml = section.bodyHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (fromHtml) return htmlToPlainText(fromHtml[1]).trim();
  return "";
}

function sectionBody(section: SpotlightSection, heading: string) {
  const plain = (htmlToPlainText(section.bodyHtml) || section.text).replace(/\s+/g, " ").trim();
  if (heading && plain.toLowerCase().startsWith(heading.toLowerCase())) {
    return plain.slice(heading.length).replace(/^[:.\s]+/, "").trim();
  }
  return plain;
}

export function seedSpotlightCarouselDraft(input: {
  title: string;
  intro: string;
  author: GuideAuthor | null;
  listing: SpotlightListingDetails | null;
  photos: SpotlightPhoto[];
  cover: SpotlightCover;
  story: SpotlightSection[];
}): CarouselDraft {
  const hero = coverPhoto(input.photos, input.cover);
  const listingPhotos = (input.listing?.media ?? []).map((item) => item.url).filter(Boolean);
  const storyPhotos = input.photos.map((photo) => photo.url).filter(Boolean);
  const photos = [...new Set([hero?.url ?? "", ...listingPhotos, ...storyPhotos].filter(Boolean))];
  const coverImage = hero?.url || photos[0] || FALLBACK_EXPORT_IMAGE;
  const listingName = input.listing?.name.trim() || input.title.trim() || "Activity Spotlight";
  const area = input.listing?.area ?? "";
  const recs: CarouselRec[] = [];

  for (const section of input.story) {
    const heading = sectionHeading(section);
    const body = sectionBody(section, heading);
    if (section.type === "quote") continue;
    if (!heading && !body.trim()) continue;
    if (heading && foldName(heading) === foldName(listingName)) continue;
    const introStart = foldName(completeSentence(input.intro) || input.intro).slice(0, 32);
    if (introStart && foldName(body).startsWith(introStart)) continue;
    if (/^trade your usual/i.test(body)) continue;
    const photo = photoById(input.photos, section.placements.find((row) => row.photoId)?.photoId);
    const image = photo?.url || photos[recs.length + 1] || coverImage;
    const pack = isPackSection(section) || section.type === "tip";
    recs.push(
      recShell({
        id: section.id,
        sourceId: section.id,
        title: pack ? "Before you set off" : heading || "A closer look",
        description: pack
          ? socialExcerpt(body, 22) || "Confirm trail access, rates & accommodation before visiting."
          : socialExcerpt(body, 32),
        location: area,
        image,
        photos: photo?.url ? [photo.url, ...photos] : photos,
        kicker: pack ? "Pack for the day" : heading && /stay|overnight|longer/i.test(heading) ? "An overnight escape" : "A closer look",
        tip: pack ? packLine(body) : "",
        role: pack ? "pack" : "story",
        credit: photo?.credit || "",
        crop: photo ? { x: photo.focusX, y: photo.focusY, zoom: 1 } : { x: input.cover.focusX, y: input.cover.focusY, zoom: 1 },
      }),
    );
    if (recs.length >= 6) break;
  }

  if (!recs.some((row) => row.role === "pack")) {
    recs.push(
      recShell({
        id: "spotlight-pack",
        sourceId: "spotlight-pack",
        title: "Before you set off",
        kicker: "Pack for the day",
        tip: "Walking shoes • Water & snacks • Sun protection",
        description: "Confirm trail access, rates & accommodation availability before visiting.",
        location: area,
        image: photos[photos.length - 1] || coverImage,
        photos,
        role: "pack",
      }),
    );
  }

  if (!recs.length) {
    recs.push(
      recShell({
        id: "spotlight-story",
        sourceId: "spotlight-story",
        title: listingName,
        kicker: "The story",
        description: socialExcerpt(input.intro) || "Find your next adventure.",
        location: area,
        image: coverImage,
        photos,
      }),
    );
  }

  const base = seedCarouselDraft({
    title: input.title,
    intro: input.intro,
    items: [],
    author: input.author,
    place: area || "Joburg & nearby",
  });

  return {
    ...base,
    kind: "spotlight",
    cover: {
      ...base.cover,
      seriesLabel: "Outdoor Spotlight",
      headerTitle: listingName,
      headline: punchyHeadline(input.intro),
      supporting: socialExcerpt(input.intro, 16) || "Walking trails, bushveld views & room to breathe.",
      geoLabel: geoLine(area),
      swipePrompt: "Swipe to explore →",
      layout: "hero",
      image: coverImage,
      collage: [photos[0] ?? coverImage, photos[1] ?? coverImage, photos[2] ?? coverImage],
      crop: { x: input.cover.focusX, y: input.cover.focusY, zoom: 1 },
    },
    recs,
    author: {
      ...base.author,
      cover: (input.author?.cover_url || "").trim() || coverImage,
      tagline: input.author?.tagline?.trim() || base.author.tagline || base.author.bio,
      closing: "Your next plan starts here.",
      primaryAction: "Save this for your next outdoor escape.",
      supportingAction: `Read the ${listingName} spotlight via the link in our bio.`,
    },
  };
}

function packLine(body: string) {
  const compact = body.replace(/\s+/g, " ").trim();
  if (/•/.test(compact) && compact.length <= 80) return compact;
  return "Walking shoes • Water & snacks • Sun protection";
}
