"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGuideEvents } from "@/app/admin/content-actions";
import { applyGuideAction, duplicateCuratedGuide, saveCuratedGuide } from "@/app/admin/guide-actions";
import { CarouselWorkspace } from "@/components/admin/carousel/CarouselWorkspace";
import { GuideFieldLabel, GuideInfoBubble } from "@/components/admin/guide-desk/GuideFold";
import { GuidePhotoGrid } from "@/components/admin/guide-desk/GuidePhotoGrid";
import { GuidePlacePicker } from "@/components/admin/guide-desk/GuidePlacePicker";
import { GuideSuggestedTitles } from "@/components/admin/guide-desk/GuideSuggestedTitles";
import { StoryBuilder } from "@/components/admin/StoryBuilder";
import { SpotlightArticle } from "@/components/SpotlightArticle";
import { formatRand } from "@/lib/control-room-shared";
import type { GuideEditorRecord, SpotlightListingDetails } from "@/lib/control-room-guides";
import type { GuideAuthor } from "@/lib/guide-authors";
import { mapGuideAuthor } from "@/lib/guide-authors";
import {
  SUGGESTED_GUIDE_TITLES,
  UNDER_PRICE_TITLE,
  guideFillSummary,
  guideHasAudience,
  guideStatusLabel,
  parseUnderPriceTitle,
  toZaLocalInput,
  underPriceTitle,
  type GuideDraft,
  type GuideListingPreview,
  type GuidePlace,
} from "@/lib/guide-shared";
import {
  INTEREST_CHIPS,
  interestIdsFromKeywords,
  interestKeywordsFromIds,
  type EditorCatalog,
} from "@/lib/listing-draft";
import { joinGuideLabels } from "@/lib/guide-places";
import { createClient } from "@/lib/supabase/client";
import {
  emptySpotlightCover,
  newSpotlightId,
  pruneStoryPhotos,
  replaceListingPhotos,
  type SpotlightPhoto,
  type SpotlightSection,
  type SpotlightVisitInfo,
} from "@/lib/spotlight";

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";

const GUIDE_STEPS = [
  { key: "list", label: "Guide details" },
  { key: "audience", label: "Audience" },
  { key: "spots", label: "Activities" },
  { key: "story", label: "Story" },
  { key: "events", label: "Linked events" },
] as const;

type GuideStepKey = (typeof GUIDE_STEPS)[number]["key"];

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function audienceLabelsFor(
  draft: Pick<GuideDraft, "kind_ids" | "persona_ids" | "scale_id" | "interest_ids">,
  catalog: EditorCatalog,
) {
  return [
    ...INTEREST_CHIPS.flatMap((chip) => {
      const kind = catalog.kinds.find((row) => row.key === chip.key);
      return kind && draft.kind_ids.includes(kind.id) ? [chip.label] : [];
    }),
    ...catalog.personas.filter((persona) => draft.persona_ids.includes(persona.id)).map((persona) => persona.title),
    ...catalog.interests.filter((interest) => draft.interest_ids.includes(interest.id)).map((interest) => interest.title),
    catalog.scales.find((scale) => scale.id === draft.scale_id)?.title ?? "",
  ].filter(Boolean);
}

function areaLabel(listing: GuideListingPreview | null) {
  if (!listing) return "Listing missing";
  return [listing.suburb, listing.city].filter(Boolean).join(", ") || "South Africa";
}

export function GuideEditor({
  guide,
  catalog,
  notice,
  error,
  events,
  carouselEvents = [],
  linkedEventIds,
  places,
  authors = [],
  canPublish = true,
  lockAuthor = false,
  listing = null,
}: {
  guide: GuideEditorRecord;
  catalog: EditorCatalog;
  notice?: string;
  error?: string;
  events: { id: string; title: string }[];
  carouselEvents?: import("@/lib/guide-carousel").CarouselEventSource[];
  linkedEventIds: string[];
  places: GuidePlace[];
  authors?: GuideAuthor[];
  canPublish?: boolean;
  lockAuthor?: boolean;
  listing?: SpotlightListingDetails | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const dragId = useRef<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [listingQuery, setListingQuery] = useState("");
  const [listingResults, setListingResults] = useState<GuideListingPreview[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickerFor, setPickerFor] = useState<"new" | string | null>(null);
  const [pickerInterestIds, setPickerInterestIds] = useState<string[]>(guide.interest_ids);
  const [pickerInterestQuery, setPickerInterestQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const savedPrice = parseUnderPriceTitle(guide.title === "Untitled Guide" ? "" : guide.title);
  const savedPlace = places.find((place) => place.name === savedPrice?.placeName) ?? null;
  const [priceOn, setPriceOn] = useState(Boolean(savedPrice));
  const [priceAmount, setPriceAmount] = useState(savedPrice?.amount ?? 200);
  const [amountText, setAmountText] = useState(String(savedPrice?.amount ?? 200));
  const [placeIds, setPlaceIds] = useState<string[]>(() =>
    guide.place_ids?.length
      ? guide.place_ids
      : savedPlace
        ? [savedPlace.id]
        : [],
  );
  const [fillKey, setFillKey] = useState(0);
  const [filling, setFilling] = useState(false);
  const [matchNote, setMatchNote] = useState("");
  const [matches, setMatches] = useState<GuideListingPreview[]>([]);
  const fillSkip = useRef(true);
  const placesRef = useRef(places);
  placesRef.current = places;
  const [exportOpen, setExportOpen] = useState(false);
  const [carouselSaved, setCarouselSaved] = useState(guide.carousel_draft);
  const [activeStep, setActiveStep] = useState<GuideStepKey>("list");
  const [interestKeywords, setInterestKeywords] = useState(() =>
    interestKeywordsFromIds(guide.interest_ids, catalog.interests),
  );
  const [openSteps, setOpenSteps] = useState<Record<GuideStepKey, boolean>>({
    list: true,
    audience: true,
    spots: true,
    story: guide.shape === "spotlight",
    events: linkedEventIds.length > 0,
  });
  const [story, setStory] = useState(guide.story);
  const [photos, setPhotos] = useState(guide.photos);
  const [cover, setCover] = useState(guide.cover.photoId ? guide.cover : emptySpotlightCover());
  const [activity, setActivity] = useState(listing);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shapeWarn, setShapeWarn] = useState<"roundup" | "spotlight" | null>(null);
  const [photoPending, setPhotoPending] = useState(false);
  const [storySave, setStorySave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [storySaveError, setStorySaveError] = useState<string | null>(null);
  const [evergreen, setEvergreen] = useState(!guide.expire_at);
  const [publishNow, setPublishNow] = useState(!guide.publish_at);
  const [draft, setDraft] = useState<GuideDraft>(() => ({
    title: guide.title === "Untitled Guide" ? "" : guide.title,
    intro: guide.intro ?? "",
    body: guide.body ?? "",
    shape: guide.shape === "spotlight" ? "spotlight" : "roundup",
    author_id: guide.author_id ?? "",
    publish_at: toZaLocalInput(guide.publish_at),
    expire_at: toZaLocalInput(guide.expire_at),
    kind_ids: guide.kind_ids,
    persona_ids: guide.persona_ids,
    scale_id: guide.scale_id ?? "",
    interest_ids: guide.interest_ids,
    items: guide.items,
  }));

  useEffect(() => {
    if (!listing) return;
    setActivity(listing);
    setPhotos((current) => {
      const next = replaceListingPhotos(current, listing.media);
      setStory((story) => pruneStoryPhotos(story, next));
      setCover((prev) => {
        if (next.some((photo) => photo.id === prev.photoId)) return prev;
        const coverMediaId = listing.media.find((item) => item.isCover)?.id;
        const preferred =
          next.find((photo) => photo.listingMediaId === coverMediaId) ?? next[0] ?? null;
        return preferred ? { ...prev, photoId: preferred.id } : prev;
      });
      return next;
    });
  }, [listing]);

  useEffect(() => {
    setCarouselSaved(guide.carousel_draft);
  }, [guide.carousel_draft]);

  const pickerSelectedInterests = useMemo(
    () => catalog.interests.filter((item) => pickerInterestIds.includes(item.id)),
    [catalog.interests, pickerInterestIds],
  );

  const pickerInterestResults = useMemo(() => {
    const q = pickerInterestQuery.trim().toLowerCase();
    if (!q) return [];
    return catalog.interests
      .filter((item) => item.title.toLowerCase().includes(q))
      .slice(0, 12);
  }, [catalog.interests, pickerInterestQuery]);

  function jump(key: GuideStepKey) {
    setActiveStep(key);
    setOpenSteps((current) => ({ ...current, [key]: true }));
    document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const audienceKey = [
    [...draft.kind_ids].sort().join(","),
    [...draft.persona_ids].sort().join(","),
    draft.scale_id,
    [...draft.interest_ids].sort().join(","),
  ].join("|");
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const placeKey = [...placeIds].sort().join(",");
  const fillSnapshot = useRef({ audienceKey, fillKey, placeKey, priceAmount, priceOn });

  const pickerInterestKey = pickerInterestIds.join(",");

  const pickerListings = useMemo(
    () => listingResults.filter((listing) => !draft.items.some((item) => item.listing_id === listing.id)),
    [draft.items, listingResults],
  );

  useEffect(() => {
    if (!pickerFor) return;
    let cancelled = false;
    setSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (listingQuery.trim()) params.set("q", listingQuery.trim());
        if (pickerInterestKey) params.set("interests", pickerInterestKey);
        const res = await fetch(`/api/admin/guides/listings?${params.toString()}`);
        const body = (await res.json()) as { listings?: GuideListingPreview[] };
        if (!cancelled) setListingResults(body.listings ?? []);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [listingQuery, pickerFor, pickerInterestKey]);

  useEffect(() => {
    const previous = fillSnapshot.current;
    const audienceOnly =
      previous.audienceKey !== audienceKey &&
      previous.fillKey === fillKey &&
      previous.placeKey === placeKey &&
      previous.priceAmount === priceAmount &&
      previous.priceOn === priceOn;
    fillSnapshot.current = { audienceKey, fillKey, placeKey, priceAmount, priceOn };
    const firstPass = fillSkip.current;
    if (fillSkip.current) fillSkip.current = false;
    const chosen = placesRef.current.filter((item) => placeIds.includes(item.id));
    const placeLabel = joinGuideLabels(chosen.map((item) => item.name)) || null;
    const amount = priceOn ? Math.round(priceAmount) : null;
    const hasAmount = amount != null && Number.isFinite(amount) && amount > 0;
    const audience = draftRef.current;
    const hasAudience = guideHasAudience({
      kindIds: audience.kind_ids,
      personaIds: audience.persona_ids,
      scaleId: audience.scale_id,
      interestIds: audience.interest_ids,
    });
    if (!hasAmount && !chosen.length && !hasAudience) return;
    if (priceOn && !hasAmount) return;
    if (draftRef.current.shape === "spotlight") return;
    const scrollToList = !audienceOnly;

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setFilling(true);
      try {
        const params = new URLSearchParams({ fill: "1" });
        if (hasAmount) params.set("maxPrice", String(amount));
        if (chosen.length) params.set("places", chosen.map((item) => item.name).join("|"));
        if (audience.kind_ids.length) params.set("kinds", audience.kind_ids.join(","));
        if (audience.persona_ids.length) params.set("personas", audience.persona_ids.join(","));
        if (audience.scale_id) params.set("scale", audience.scale_id);
        if (audience.interest_ids.length) params.set("interests", audience.interest_ids.join(","));
        const res = await fetch(`/api/admin/guides/listings?${params.toString()}`);
        const body = (await res.json()) as {
          listings?: GuideListingPreview[];
          total?: number;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setMatchNote(body.error || "Those listings could not be loaded.");
          return;
        }
        const listings = body.listings ?? [];
        const total = body.total ?? listings.length;
        const labels = audienceLabelsFor(audience, catalogRef.current);
        const summary = guideFillSummary(
          listings.length,
          total,
          hasAmount ? amount : null,
          placeLabel,
          joinGuideLabels(labels) || null,
        );
        setMatches(listings);
        setMatchNote(summary);
        setOpenSteps((current) => ({ ...current, spots: true }));
        setSaveNotice(null);
        if (scrollToList && !firstPass) {
          setActiveStep("spots");
          document.getElementById("step-spots")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch {
        if (!cancelled) setMatchNote("Those listings could not be loaded.");
      } finally {
        if (!cancelled) setFilling(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [audienceKey, fillKey, placeIds, placeKey, priceAmount, priceOn]);

  function patch(partial: Partial<GuideDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setSaveNotice(null);
  }

  function togglePickerInterest(id: string) {
    setPickerInterestIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 12),
    );
  }

  function toggleFeature(listing: GuideListingPreview) {
    if (draft.items.some((item) => item.listing_id === listing.id)) {
      removeItem(listing.id);
      return;
    }
    patch({
      items: [...draft.items, { listing_id: listing.id, editorial_note: "", listing }],
    });
  }

  function addListing(listing: GuideListingPreview) {
    if (draft.items.some((item) => item.listing_id === listing.id) && pickerFor === "new") return;
    if (pickerFor && pickerFor !== "new") {
      patch({
        items: draft.items.map((item) =>
          item.listing_id === pickerFor
            ? { listing_id: listing.id, editorial_note: item.editorial_note, listing }
            : item,
        ),
      });
    } else if (draft.shape === "spotlight") {
      patch({
        items: [{ listing_id: listing.id, editorial_note: "", listing }],
      });
    } else {
      patch({
        items: [
          ...draft.items,
          { listing_id: listing.id, editorial_note: "", listing },
        ],
      });
    }
    setPickerFor(null);
    setListingQuery("");
    const listingImage = listing.image;
    if (listingImage) {
      setPhotos((current) => {
        if (current.some((photo) => photo.url === listingImage)) return current;
        const photo = uploadedPhoto(listingImage, "listing");
        setCover((prev) => (prev.photoId ? prev : { ...prev, photoId: photo.id }));
        return [...current, photo];
      });
    }
    if (draft.shape === "spotlight") void linkSpotlightListing(listing.id);
  }

  function uploadedPhoto(url: string, source: SpotlightPhoto["source"] = "upload"): SpotlightPhoto {
    return {
      id: newSpotlightId(),
      source,
      listingMediaId: null,
      url,
      alt: "",
      caption: "",
      credit: "",
      cover: false,
      gallery: source === "upload",
      instagram: false,
      focusX: 50,
      focusY: 50,
    };
  }

  async function onUploadPhotos(files: FileList | null) {
    const list = [...(files ?? [])];
    if (!list.length) return;
    setPhotoPending(true);
    setSaveError(null);
    const supabase = createClient();
    if (!supabase) {
      setSaveError("Could not reach photo storage.");
      setPhotoPending(false);
      return;
    }
    const added: SpotlightPhoto[] = [];
    for (const file of list) {
      const allowed = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
      if (!allowed || /heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) {
        setSaveError(`${file.name}: use a JPEG, PNG, WebP, or GIF.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setSaveError(`${file.name}: keep it under 10 MB.`);
        continue;
      }
      const key = `${guide.id}/${newSpotlightId()}-${file.name.replace(/\s+/g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("guide-spotlight").upload(key, file, {
        cacheControl: "3600",
        contentType: file.type.startsWith("image/") ? file.type : "image/jpeg",
        upsert: false,
      });
      if (uploadError) {
        setSaveError(`${file.name}: ${uploadError.message}`);
        continue;
      }
      const { data } = supabase.storage.from("guide-spotlight").getPublicUrl(key);
      added.push(uploadedPhoto(data.publicUrl));
    }
    if (added.length) {
      setPhotos((current) => {
        setCover((prev) => (prev.photoId ? prev : { ...prev, photoId: added[0].id }));
        return [...current, ...added];
      });
    }
    setPhotoPending(false);
    if (photoRef.current) photoRef.current.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    setCover((current) => {
      if (current.photoId !== id) return current;
      const next = photos.find((photo) => photo.id !== id);
      return { ...current, photoId: next?.id ?? null };
    });
  }

  function removeItem(listingId: string) {
    patch({ items: draft.items.filter((item) => item.listing_id !== listingId) });
  }

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const fromIndex = draft.items.findIndex((item) => item.listing_id === fromId);
    const toIndex = draft.items.findIndex((item) => item.listing_id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...draft.items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    patch({ items: next });
  }

  function moveItem(listingId: string, direction: -1 | 1) {
    const fromIndex = draft.items.findIndex((item) => item.listing_id === listingId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= draft.items.length) return;
    reorder(listingId, draft.items[toIndex].listing_id);
  }

  function onSave() {
    setSaveError(null);
    startTransition(async () => {
      const result = await saveCuratedGuide(guide.id, {
        title: draft.title,
        slug: guide.slug,
        intro: draft.intro,
        body: draft.shape === "spotlight" ? "" : draft.body,
        shape: draft.shape,
        author_id: draft.author_id,
        publish_at: publishNow ? "" : draft.publish_at,
        expire_at: evergreen ? "" : draft.expire_at,
        kind_ids: draft.kind_ids,
        persona_ids: draft.persona_ids,
        scale_id: draft.scale_id,
        interest_ids: draft.interest_ids,
        items: draft.items.map((item) => ({
          listing_id: item.listing_id,
          editorial_note: item.editorial_note,
        })),
        listing_id: draft.shape === "spotlight" ? draft.items[0]?.listing_id ?? "" : "",
        story,
        photos,
        cover,
        place_ids: placeIds,
      });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setSaveNotice("Saved just now");
      router.refresh();
    });
  }

  async function persistStory(nextStory: SpotlightSection[]) {
    setStorySave("saving");
    setStorySaveError(null);
    const result = await saveCuratedGuide(guide.id, {
      title: draft.title.trim() || "Untitled Guide",
      slug: guide.slug,
      intro: draft.intro,
      body: "",
      shape: draft.shape,
      author_id: draft.author_id,
      publish_at: publishNow ? "" : draft.publish_at,
      expire_at: evergreen ? "" : draft.expire_at,
      kind_ids: draft.kind_ids,
      persona_ids: draft.persona_ids,
      scale_id: draft.scale_id,
      interest_ids: draft.interest_ids,
      items: draft.items.map((item) => ({
        listing_id: item.listing_id,
        editorial_note: item.editorial_note,
      })),
      listing_id: draft.shape === "spotlight" ? draft.items[0]?.listing_id ?? "" : "",
      story: nextStory,
      photos,
      cover,
      place_ids: placeIds,
    });
    if (!result.ok) {
      setStorySave("failed");
      setStorySaveError(result.error);
      return false;
    }
    setStorySave("saved");
    return true;
  }

  function requestShape(next: "roundup" | "spotlight") {
    if (next === draft.shape) return;
    const hasStory = story.length > 0;
    const extraItems = draft.items.length > 1;
    if (next === "spotlight" && extraItems) {
      setShapeWarn("spotlight");
      return;
    }
    if (next === "roundup" && hasStory) {
      setShapeWarn("roundup");
      return;
    }
    applyShape(next);
  }

  function applyShape(next: "roundup" | "spotlight") {
    patch({
      shape: next,
      items: next === "spotlight" ? draft.items.slice(0, 1) : draft.items,
    });
    setShapeWarn(null);
    if (next === "spotlight") jump("story");
    else jump("spots");
  }

  async function linkSpotlightListing(id: string) {
    const res = await fetch(`/api/admin/guides/listings?id=${encodeURIComponent(id)}`);
    const body = (await res.json()) as { listing?: SpotlightListingDetails | null };
    const next = body.listing ?? null;
    setActivity(next);
    if (next) {
      setPhotos((current) => {
        const nextPhotos = replaceListingPhotos(current, next.media);
        setStory((story) => pruneStoryPhotos(story, nextPhotos));
        setCover((prev) => {
          if (nextPhotos.some((photo) => photo.id === prev.photoId)) return prev;
          const coverMediaId = next.media.find((item) => item.isCover)?.id;
          const preferred =
            nextPhotos.find((photo) => photo.listingMediaId === coverMediaId) ?? nextPhotos[0] ?? null;
          return preferred ? { ...prev, photoId: preferred.id } : prev;
        });
        return nextPhotos;
      });
    }
  }

  const visit: SpotlightVisitInfo | null = activity
    ? {
        name: activity.name,
        slug: activity.slug,
        area: activity.area,
        fromPrice: activity.fromPrice == null || activity.fromPrice === "" ? null : Number(activity.fromPrice),
        bookingUrl: activity.bookingUrl,
        websiteUrl: activity.websiteUrl,
        phone: activity.phone,
        bookingRequired: activity.bookingRequired,
        indoorOutdoor: activity.indoorOutdoor,
        hours: activity.hours,
      }
    : null;
  const credited = authors.find((row) => row.id === draft.author_id) ?? null;
  const spotlightCarousel = useMemo(
    () =>
      draft.shape === "spotlight"
        ? { listing: activity, photos, cover, story }
        : undefined,
    [draft.shape, activity, photos, cover, story],
  );
  const coverReady = Boolean(cover.photoId || draft.items[0]?.listing?.image);
  const checks = [
    { id: "title", ok: Boolean(draft.title.trim()), label: "Title", href: "step-list" },
    { id: "author", ok: Boolean(draft.author_id), label: "Author assigned", href: "field-author" },
    {
      id: "activities",
      ok: draft.items.length > 0,
      label: draft.shape === "spotlight" ? "Activity linked" : "Activities linked",
      href: "step-spots",
    },
    { id: "cover", ok: coverReady, label: "Cover image", href: "field-cover" },
  ];

  const isNew = guide.title === "Untitled Guide" && guide.items.length === 0;
  const heading = draft.title.trim() || "Untitled Guide";
  const audienceSummary = joinGuideLabels(audienceLabelsFor(draft, catalog)) || "None yet";

  const visibleSteps = GUIDE_STEPS.filter((step) => (step.key === "story" ? draft.shape === "spotlight" : true));

  return (
    <div className="cr-editor-page guide-desk">
      <aside className="cr-edit-nav" aria-label="Edit guide">
        <a className="cr-edit-spine" href="/admin/guides">
          <span className="cr-edit-spine-mark" aria-hidden="true" />
          <span>Guides</span>
        </a>
        <div className="cr-edit-nav-body">
          <a className="cr-edit-brand" href="/admin/guides" aria-label="Guides">
            <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="Venturo" />
          </a>
          <p className="cr-edit-title">Guide editor</p>
          <p className="cr-edit-current">{isNew ? "New Guide" : "Edit Guide"}</p>
          <nav className="cr-edit-steps">
            {visibleSteps.map((step) => (
              <button
                key={step.key}
                type="button"
                className={activeStep === step.key ? "active" : undefined}
                aria-current={activeStep === step.key ? "true" : undefined}
                onClick={() => jump(step.key)}
              >
                {step.key === "spots" && draft.shape === "spotlight" ? "Activity" : step.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="cr-editor-stage">
      <header className="guide-desk-bar">
        <div className="guide-desk-bar-title">
          <a href="/admin/guides">All guides</a>
          <h1>{heading}</h1>
          <span className="guide-desk-status">{guideStatusLabel(guide.status)}</span>
          <span className="muted">{pending ? "Saving…" : saveNotice || "Draft"}</span>
        </div>
        <div className="guide-desk-bar-actions">
          <button className="btn btn-secondary" type="button" onClick={() => setPreviewOpen(true)}>
            Preview
          </button>
          <button className="btn btn-secondary" type="button" onClick={onSave} disabled={pending}>
            Save draft
          </button>
          {canPublish ? (
            <form action={applyGuideAction}>
              <input type="hidden" name="id" value={guide.id} />
              <input type="hidden" name="action" value={guide.status === "published" ? "unpublish" : "publish"} />
              <button className="btn btn-primary" type="submit">
                {guide.status === "published" ? "Unpublish" : publishNow ? "Publish guide" : "Schedule"}
              </button>
            </form>
          ) : (
            <form action={applyGuideAction}>
              <input type="hidden" name="id" value={guide.id} />
              <input type="hidden" name="action" value="submit" />
              <button className="btn btn-primary" type="submit">
                Submit for review
              </button>
            </form>
          )}
          <details className="guide-desk-menu" open={menuOpen} onToggle={(event) => setMenuOpen(event.currentTarget.open)}>
            <summary aria-label="More actions">⋯</summary>
            <div>
              {canPublish && guide.status !== "archived" ? (
                <form action={applyGuideAction}>
                  <input type="hidden" name="id" value={guide.id} />
                  <input type="hidden" name="action" value="archive" />
                  <button type="submit">Archive</button>
                </form>
              ) : null}
              <form action={duplicateCuratedGuide}>
                <input type="hidden" name="id" value={guide.id} />
                <button type="submit">Duplicate</button>
              </form>
            </div>
          </details>
        </div>
      </header>

      {(error || saveError) && <p className="error">{error || saveError}</p>}
      {(notice || saveNotice) && saveNotice !== "Saved just now" ? <p className="notice">{notice}</p> : null}

      <div className="guide-desk-work">
      <div className="guide-desk-main">
        <section className="guide-desk-card" id="step-list">
          <header className="guide-desk-card-head">
            <h2><span>01</span> Guide details</h2>
            <div className="guide-desk-type" role="group" aria-label="Guide type">
              <button
                type="button"
                className={draft.shape === "roundup" ? "is-on" : undefined}
                onClick={() => requestShape("roundup")}
              >
                Collection
              </button>
              <button
                type="button"
                className={draft.shape === "spotlight" ? "is-on" : undefined}
                onClick={() => requestShape("spotlight")}
              >
                Spotlight
              </button>
            </div>
          </header>
          <label className="field" id="field-title">
            <span>Guide title</span>
            <input
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Top Things to Do This Weekend"
            />
          </label>
          <label className="field" id="field-author">
            <span>Author</span>
            <select
              value={draft.author_id}
              disabled={lockAuthor}
              onChange={(event) => patch({ author_id: event.target.value })}
            >
              <option value="">Select author</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.display_name}
                  {author.tagline ? ` — ${author.tagline}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="field" id="field-cover">
            <GuideFieldLabel info="The library sits under Publishing. Click a photo there to make it the cover.">
              Cover photo
            </GuideFieldLabel>
            <div className="guide-desk-cover is-hero">
              {photos.find((photo) => photo.id === cover.photoId)?.url || draft.items[0]?.listing?.image ? (
                <img
                  src={photos.find((photo) => photo.id === cover.photoId)?.url ?? draft.items[0]?.listing?.image ?? FALLBACK_IMAGE}
                  alt=""
                />
              ) : (
                <span className="muted">No cover yet. Add photos under Publishing.</span>
              )}
              <div>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={(event) => void onUploadPhotos(event.target.files)}
                />
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={photoPending}
                  onClick={() => photoRef.current?.click()}
                >
                  {photoPending ? "Uploading…" : "Add photos"}
                </button>
              </div>
            </div>
          </div>
          <GuideSuggestedTitles
            titles={SUGGESTED_GUIDE_TITLES}
            activeTitle={priceOn ? UNDER_PRICE_TITLE : draft.title}
            info="Amount, place & audience find matching activities. Tick the ones to feature on this Collection. A listing has to fit every audience group you turn on. Only prices ticked Include in From are counted when an amount is set."
            onPick={(title) => {
              if (title === UNDER_PRICE_TITLE) {
                setPriceOn(true);
                setPriceAmount(200);
                setAmountText("200");
                setFillKey((current) => current + 1);
                return;
              }
              setPriceOn(false);
              patch({ title });
              setFillKey((current) => current + 1);
            }}
          />
          {priceOn ? (
            <label className="field">
              <span>At most (R)</span>
              <input
                type="number"
                min={1}
                step={50}
                value={amountText}
                aria-label="Maximum price in rand"
                onChange={(event) => setAmountText(event.target.value)}
                onBlur={() => {
                  const amount = Math.round(Number(amountText));
                  if (!Number.isFinite(amount) || amount <= 0) return;
                  setAmountText(String(amount));
                  setPriceAmount(amount);
                  setFillKey((current) => current + 1);
                }}
              />
            </label>
          ) : null}
          <GuidePlacePicker
            places={places}
            selectedIds={placeIds}
            onChange={(ids) => {
              if (priceOn) {
                const amount = Math.round(Number(amountText));
                if (Number.isFinite(amount) && amount > 0) {
                  setAmountText(String(amount));
                  setPriceAmount(amount);
                }
              }
              setPlaceIds(ids);
              setFillKey((current) => current + 1);
            }}
          />
          <p className="muted">{filling ? "Finding listings…" : matchNote}</p>
          <label className="field" style={{ marginTop: 18 }}>
            <span>Short Intro (optional)</span>
            <textarea
              rows={3}
              value={draft.intro}
              onChange={(e) => patch({ intro: e.target.value })}
              placeholder="The weekend is calling. Here are five kid-friendly adventures worth getting out of the house for."
            />
          </label>
        </section>

        <section className="guide-desk-card" id="step-audience">
          <header className="guide-desk-card-head">
            <h2>
              <span>02</span> Audience
              <GuideInfoBubble label="How audience works">
                Choose who this guide is for. A listing has to fit every audience group you turn on.
              </GuideInfoBubble>
            </h2>
            <p className="muted">{audienceSummary}</p>
          </header>
          <div className="guide-desk-audience">
            <div>
              <p className="cr-about-label">Interests · Select multiple</p>
              <div className="guide-desk-chips">
                {INTEREST_CHIPS.map((item) => {
                  const kind = catalog.kinds.find((row) => row.key === item.key);
                  if (!kind) return null;
                  const active = draft.kind_ids.includes(kind.id);
                  return (
                    <button
                      key={kind.id}
                      type="button"
                      className={active ? "is-on" : undefined}
                      aria-pressed={active}
                      onClick={() => patch({ kind_ids: toggleId(draft.kind_ids, kind.id) })}
                    >
                      {active ? <i aria-hidden="true">✓</i> : null}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="cr-about-label">Who is going? · Select multiple</p>
              <div className="guide-desk-chips">
                {catalog.personas.map((persona) => {
                  const active = draft.persona_ids.includes(persona.id);
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      className={active ? "is-on" : undefined}
                      aria-pressed={active}
                      onClick={() => patch({ persona_ids: toggleId(draft.persona_ids, persona.id) })}
                    >
                      {active ? <i aria-hidden="true">✓</i> : null}
                      {persona.title}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="cr-about-label">Adventure level · Select one</p>
              <div className="guide-desk-chips" role="radiogroup" aria-label="Adventure level">
                {catalog.scales.map((scale) => {
                  const active = draft.scale_id === scale.id;
                  return (
                    <button
                      key={scale.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={active ? "is-on" : undefined}
                      title={scale.subtitle}
                      onClick={() => patch({ scale_id: active ? "" : scale.id })}
                    >
                      {active ? <i aria-hidden="true">✓</i> : null}
                      {scale.title}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="field cr-quiet">
              <span>Keywords (optional)</span>
              <input
                value={interestKeywords}
                onChange={(event) => {
                  const value = event.target.value;
                  setInterestKeywords(value);
                  patch({ interest_ids: interestIdsFromKeywords(value, catalog.interests) });
                }}
                placeholder="weekend, joburg"
              />
            </label>
          </div>
          <p className="muted">{filling ? "Finding listings…" : matchNote}</p>
        </section>

        <section className="guide-desk-card" id="step-spots">
          <header className="guide-desk-card-head">
            <h2>
              <span>03</span>{" "}
              {draft.shape === "spotlight"
                ? "Activity"
                : `Activities${draft.items.length ? ` · ${draft.items.length} featured` : ""}`}
              <GuideInfoBubble label="How activities work">
                {draft.shape === "roundup"
                  ? "Tick matching activities to feature them. Directory details stay linked. Write-up sits under the name on the Guide. Instagram export stays on the activity."
                  : "Directory details stay linked."}
              </GuideInfoBubble>
            </h2>
            {draft.shape === "roundup" ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setFilterOpen(false);
                  setSearching(true);
                  setPickerFor(pickerFor === "new" ? null : "new");
                  setListingQuery("");
                }}
              >
                {pickerFor === "new" ? "Close search" : "+ Add activity"}
              </button>
            ) : null}
          </header>
          {draft.shape === "roundup" && (matches.length > 0 || filling) ? (
            <div className="guide-desk-matches">
              <p className="cr-about-label">Matching activities</p>
              <p className="muted">
                {filling
                  ? "Finding listings…"
                  : `${matches.length} match`}
              </p>
              <ul>
                {matches.map((listing) => {
                  const featured = draft.items.some((item) => item.listing_id === listing.id);
                  return (
                    <li key={listing.id}>
                      <label className={featured ? "is-on" : undefined}>
                        <input
                          type="checkbox"
                          checked={featured}
                          onChange={() => toggleFeature(listing)}
                        />
                        <img src={listing.image ?? FALLBACK_IMAGE} alt="" />
                        <span>
                          <strong>{listing.name}</strong>
                          <em>
                            {areaLabel(listing)}
                            {listing.price_from != null ? ` · From ${formatRand(listing.price_from)}` : ""}
                          </em>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <div className="cr-guide-items">
            {draft.shape === "roundup" && draft.items.length > 0 ? (
              <p className="cr-about-label">Featured on this guide</p>
            ) : null}
            {draft.items.length === 0 && (
              <p className="muted">
                {draft.shape === "roundup"
                  ? "No featured activities yet. Tick matches above, or add a live listing."
                  : "No recommendations yet. Choose a place or audience, or add a live listing below."}
              </p>
            )}
            {draft.items.map((item, index) => (
              <article
                key={item.listing_id}
                className="cr-guide-item"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId.current) reorder(dragId.current, item.listing_id);
                  dragId.current = null;
                }}
              >
                <button
                  type="button"
                  className="cr-guide-drag"
                  draggable
                  aria-label={`Drag to reorder ${item.listing?.name ?? "listing"}`}
                  onDragStart={() => {
                    dragId.current = item.listing_id;
                  }}
                  onDragEnd={() => {
                    dragId.current = null;
                  }}
                >
                  ⋮⋮
                </button>
                <img
                  src={item.listing?.image ?? FALLBACK_IMAGE}
                  alt=""
                />
                <div>
                  <p className="eyebrow">
                    {index + 1}. {item.listing?.status === "approved" ? "Live" : "Unavailable"}
                  </p>
                  <h3>{item.listing?.name ?? "Listing missing"}</h3>
                  <p className="muted">
                    {areaLabel(item.listing)}
                    {item.listing?.price_from != null
                      ? ` · From ${formatRand(item.listing.price_from)}`
                      : ""}
                  </p>
                  <p className="muted">
                    {item.listing?.status === "approved" ? "Live · Linked directory listing" : "Listing missing"}
                  </p>
                  {draft.shape === "roundup" ? (
                  <label className="field">
                    <span>Write-up</span>
                    <textarea
                      rows={4}
                      value={item.editorial_note}
                      onChange={(e) =>
                        patch({
                          items: draft.items.map((row) =>
                            row.listing_id === item.listing_id
                              ? { ...row, editorial_note: e.target.value }
                              : row,
                          ),
                        })
                      }
                      placeholder="Why this one is worth the drive. Keep it specific."
                    />
                  </label>
                  ) : null}
                  <div className="cr-guide-item-tools">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveItem(item.listing_id, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={index === draft.items.length - 1}
                      onClick={() => moveItem(item.listing_id, 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterOpen(false);
                        setSearching(true);
                        setPickerFor(item.listing_id);
                        setListingQuery("");
                      }}
                    >
                      Replace
                    </button>
                    <button type="button" onClick={() => removeItem(item.listing_id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="cr-guide-picker">
            {draft.shape === "spotlight" && draft.items.length === 0 ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setPickerFor("new");
                  setListingQuery("");
                }}
              >
                Link activity
              </button>
            ) : null}
            {pickerFor && (
              <div className="cr-guide-search">
                <label className="field">
                  <span>{pickerFor === "new" ? "Search Live Listings" : "Replace With"}</span>
                  <input
                    value={listingQuery}
                    onChange={(e) => setListingQuery(e.target.value)}
                    placeholder="Search by name"
                    autoFocus
                  />
                </label>
                <p className="muted">
                  {pickerSelectedInterests.length
                    ? `Filtered by ${pickerSelectedInterests.map((interest) => interest.title).join(", ")}.`
                    : "Searching all live listings."}
                </p>
                <button
                  className="cr-text-remove"
                  type="button"
                  onClick={() => setFilterOpen((current) => !current)}
                >
                  {filterOpen ? "Hide interest filter" : "Filter by interest"}
                </button>
                {pickerSelectedInterests.length > 0 && (
                  <div className="cr-chip-grid cr-selected-chips">
                    {pickerSelectedInterests.map((interest) => (
                      <button
                        key={interest.id}
                        type="button"
                        className="cr-tag active"
                        onClick={() => togglePickerInterest(interest.id)}
                      >
                        {interest.title} ×
                      </button>
                    ))}
                    <button
                      type="button"
                      className="cr-tag"
                      onClick={() => setPickerInterestIds([])}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                {filterOpen ? (
                  <>
                    <label className="field">
                      <span>Filter Interests</span>
                      <input
                        value={pickerInterestQuery}
                        onChange={(e) => setPickerInterestQuery(e.target.value)}
                        placeholder="Kids, Adventure, Couples…"
                      />
                    </label>
                    {pickerInterestQuery.trim() && pickerInterestResults.length === 0 ? (
                      <p className="muted">No matching interests.</p>
                    ) : null}
                    <div className="cr-chip-grid">
                      {pickerInterestResults.map((interest) => (
                        <button
                          key={interest.id}
                          type="button"
                          className={pickerInterestIds.includes(interest.id) ? "cr-tag active" : "cr-tag"}
                          onClick={() => togglePickerInterest(interest.id)}
                        >
                          {interest.title}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                {searching && <p className="muted">Searching…</p>}
                {!searching && pickerListings.length === 0 && (
                  <p className="muted">
                    No live listings match. Try another name, or clear the filter.
                  </p>
                )}
                <ul className="cr-guide-results">
                  {pickerListings.map((listing) => (
                    <li key={listing.id}>
                      <button type="button" onClick={() => addListing(listing)}>
                        <strong>{listing.name}</strong>
                        <span className="muted">
                          {areaLabel(listing)}
                          {listing.price_from != null ? ` · From ${formatRand(listing.price_from)}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {draft.shape === "spotlight" ? (
          <StoryBuilder
            story={story}
            photos={photos}
            cover={cover}
            guideId={guide.id}
            authorName={credited?.display_name}
            saveState={storySave}
            saveError={storySaveError}
            onStoryChange={setStory}
            onPhotosChange={setPhotos}
            onPersist={persistStory}
            onPreviewFull={() => setPreviewOpen(true)}
            kind={
              activity?.activityKindKey ?? draft.items[0]?.listing?.activity_kind_key ?? null
            }
          />
        ) : null}

        <form
          action={saveGuideEvents}
          className="guide-desk-card"
          id="step-events"
        >
          <header className="guide-desk-card-head">
            <h2>
              <span>04</span> Linked events
              <GuideInfoBubble label="How linked events work">
                Activities stay in the list above. Tick the events this guide should open in the app.
              </GuideInfoBubble>
            </h2>
            <p className="muted">{linkedEventIds.length} events</p>
          </header>
          <input type="hidden" name="guide_id" value={guide.id} />
          {events.length === 0 ? <p className="muted">No live events yet.</p> : null}
          <div className="cr-guide-event-list">
            {events.map((event) => (
              <label key={event.id} className="cr-guide-event">
                <input
                  type="checkbox"
                  name="event_ids"
                  value={event.id}
                  defaultChecked={linkedEventIds.includes(event.id)}
                />
                <span>{event.title}</span>
              </label>
            ))}
          </div>
          {events.length > 0 ? (
            <button className="btn btn-secondary" type="submit">
              Save event links
            </button>
          ) : null}
        </form>
      </div>

      <aside className="guide-desk-rail">
        <GuidePhotoGrid
          photos={photos}
          coverId={cover.photoId}
          pending={photoPending}
          onPickCover={(id) => setCover((current) => ({ ...current, photoId: id }))}
          onRemove={removePhoto}
          onAdd={() => photoRef.current?.click()}
        />
        <section className="guide-desk-card" id="step-window">
          <h2>Publishing</h2>
          <p className="cr-about-label">Availability</p>
          <label className="guide-desk-radio">
            <input type="radio" name="availability" checked={evergreen} onChange={() => setEvergreen(true)} />
            <span>
              <strong>Evergreen</strong>
              Keep this guide available until archived.
            </span>
          </label>
          <label className="guide-desk-radio">
            <input type="radio" name="availability" checked={!evergreen} onChange={() => setEvergreen(false)} />
            <span>
              <strong>Date-specific</strong>
              Set a publish &amp; expiry date.
            </span>
          </label>
          {!evergreen ? (
            <label className="field">
              <span>Expire at (SA time)</span>
              <input type="datetime-local" value={draft.expire_at} onChange={(e) => patch({ expire_at: e.target.value })} />
            </label>
          ) : null}
          <p className="cr-about-label">Publish</p>
          <label className="guide-desk-radio">
            <input type="radio" name="publish-when" checked={publishNow} onChange={() => setPublishNow(true)} />
            <span>
              <strong>Now</strong>
              Publish this guide immediately.
            </span>
          </label>
          <label className="guide-desk-radio">
            <input type="radio" name="publish-when" checked={!publishNow} onChange={() => setPublishNow(false)} />
            <span>
              <strong>Schedule</strong>
              Choose a future date and time.
            </span>
          </label>
          {!publishNow ? (
            <label className="field">
              <span>Publish at (SA time)</span>
              <input type="datetime-local" value={draft.publish_at} onChange={(e) => patch({ publish_at: e.target.value })} />
            </label>
          ) : null}
        </section>

        <section className="guide-desk-card">
          <h2>Ready to publish</h2>
          <ul className="guide-desk-checks">
            {checks.map((check) => (
              <li key={check.id}>
                <button type="button" className={check.ok ? "is-ok" : "is-warn"} onClick={() => document.getElementById(check.href)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  {check.ok ? "✓" : "!"} {check.label}
                  {check.ok ? "" : " needs attention"}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="guide-desk-ig">
          <h2>Instagram carousel</h2>
          <p>Turn this guide into social slides.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setExportOpen(true)}>
            Create Instagram carousel
          </button>
        </section>
      </aside>
      </div>

      <CarouselWorkspace
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        guideId={guide.id}
        title={draft.title}
        intro={draft.intro}
        items={draft.shape === "spotlight" ? [] : draft.items}
        author={credited}
        place={
          activity?.area ||
          joinGuideLabels(places.filter((row) => placeIds.includes(row.id)).map((row) => row.name)) ||
          "Joburg & nearby"
        }
        savedDraft={carouselSaved}
        onSaved={setCarouselSaved}
        events={draft.shape === "spotlight" ? [] : carouselEvents}
        spotlight={spotlightCarousel}
      />
      {previewOpen ? (
        <div className="spotlight-preview-modal">
          <button type="button" className="spotlight-lightbox-backdrop" aria-label="Close preview" onClick={() => setPreviewOpen(false)} />
          <div className={`spotlight-preview-frame${draft.shape === "roundup" ? " is-collection" : ""}`}>
            <header>
              <strong>Preview</strong>
              <button type="button" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </header>
            {draft.shape === "spotlight" ? (
              <SpotlightArticle
                title={draft.title}
                intro={draft.intro}
                slug={guide.slug}
                cover={cover}
                photos={photos}
                story={story}
                listing={visit}
                author={credited ? mapGuideAuthor(credited) : null}
                compact
                kind={activity?.activityKindKey ?? draft.items[0]?.listing?.activity_kind_key ?? null}
                chip={
                  INTEREST_CHIPS.find(
                    (chip) =>
                      chip.key ===
                      (activity?.activityKindKey ?? draft.items[0]?.listing?.activity_kind_key),
                  )?.label ?? null
                }
              />
            ) : (
              <div className="guide-collection">
                <div className="shell">
                  <header className="guide-collection-head">
                    <p className="eyebrow">Guides</p>
                    <h1>{draft.title || "Untitled Guide"}</h1>
                    {draft.intro ? <p className="guide-collection-intro">{draft.intro}</p> : null}
                  </header>
                  {credited ? <p className="muted">By {credited.display_name}</p> : null}
                  <div className="guide-recs">
                    {draft.items.length === 0 ? (
                      <p className="muted">No activities on this Collection yet.</p>
                    ) : (
                      draft.items.map((item, index) => {
                        const listing = item.listing;
                        const writeUp = item.editorial_note.trim();
                        const amount = listing?.price_from;
                        const price =
                          amount == null || amount === ""
                            ? null
                            : typeof amount === "number"
                              ? amount
                              : Number(amount);
                        return (
                          <article key={item.listing_id} className="guide-rec is-stack">
                            <header className="guide-rec-copy">
                              <p className="eyebrow">{String(index + 1).padStart(2, "0")}</p>
                              <h2>{listing?.name ?? "Listing missing"}</h2>
                              {writeUp ? <p className="guide-rec-note">{writeUp}</p> : null}
                            </header>
                            <div className="card guide-rec-card">
                              <div className="card-image">
                                <img src={listing?.image ?? FALLBACK_IMAGE} alt="" />
                              </div>
                              <div className="card-body">
                                <h3>{listing?.name ?? "Listing missing"}</h3>
                                <p className="card-meta">{areaLabel(listing)}</p>
                                {price != null && Number.isFinite(price) ? (
                                  <p className="card-meta">{formatRand(price)}</p>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {shapeWarn ? (
        <div className="spotlight-preview-modal">
          <button type="button" className="spotlight-lightbox-backdrop" aria-label="Cancel" onClick={() => setShapeWarn(null)} />
          <div className="guide-desk-warn">
            <h2>Switch guide type?</h2>
            {shapeWarn === "spotlight" ? (
              <p>A Spotlight keeps one activity. Extra activities will be removed from this guide. Story &amp; gallery stay empty until you add them.</p>
            ) : (
              <p>A Collection can list several activities. Story blocks will stay saved, but they will not appear on the Collection page.</p>
            )}
            <div className="cr-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShapeWarn(null)}>
                Keep current type
              </button>
              <button type="button" className="btn btn-primary" onClick={() => applyShape(shapeWarn)}>
                Switch to {shapeWarn === "spotlight" ? "Spotlight" : "Collection"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
