"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import JSZip from "jszip";
import { saveGuideCarousel } from "@/app/admin/carousel-actions";
import { AuthorSlide } from "@/components/admin/carousel/slides/AuthorSlide";
import { CoverSlide } from "@/components/admin/carousel/slides/CoverSlide";
import { RecommendationSlide } from "@/components/admin/carousel/slides/RecommendationSlide";
import {
  SpotlightAuthorSlide,
  SpotlightCoverSlide,
  SpotlightStorySlide,
} from "@/components/admin/carousel/slides/SpotlightSlides";
import { captureIgSlide, downloadBlob } from "@/lib/capture-ig-slide";
import type { GuideAuthor } from "@/lib/guide-authors";
import {
  APPROVED_CATEGORIES,
  PRICE_BASES,
  createCarouselPost,
  exportFileSlug,
  IG_CAROUSEL_MAX,
  mergeCarouselDraft,
  parseCarouselDraft,
  seedCarouselDraft,
  seedRecFromEvent,
  spotlightBackdrop,
  spotlightPostAlign,
  spotlightTemplate,
  spotlightTypeStyle,
  BACKDROP_COLOURS,
  COPY_SIZE_MAX,
  COPY_SIZE_MIN,
  HEADING_SIZE_MAX,
  HEADING_SIZE_MIN,
  validateCarousel,
  wordCount,
  type CarouselAuthor,
  type CarouselCover,
  type CarouselCrop,
  type CarouselDraft,
  type CarouselEventSource,
  type CarouselRec,
  type PostAlign,
  type PriceBasis,
  type SlideBackdrop,
  type SpotlightInk,
  type SpotlightSlideTemplate,
  type TypeAlign,
  type TypeStyle,
} from "@/lib/guide-carousel";
import { seedSpotlightCarouselDraft } from "@/lib/spotlight-carousel";
import type { GuideDraftItem } from "@/lib/guide-shared";
import type { SpotlightListingDetails } from "@/lib/control-room-guides";
import type { SpotlightCover, SpotlightPhoto, SpotlightSection } from "@/lib/spotlight";

type SlideKey = "cover" | "author" | string;

function uniquifyRecs(recs: CarouselRec[]): CarouselRec[] {
  const seen = new Set<string>();
  return recs.map((rec, index) => {
    let id = rec.id || rec.sourceId || `rec-${index}`;
    if (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    return id === rec.id ? rec : { ...rec, id };
  });
}

function hydrateCarousel(savedDraft: unknown, seed: CarouselDraft, title: string): CarouselDraft {
  const next = mergeCarouselDraft(parseCarouselDraft(savedDraft), seed);
  const recs = uniquifyRecs(next.recs);
  if (seed.kind === "spotlight" && next.cover.headline.trim() === title.trim()) {
    return { ...next, recs, cover: { ...next.cover, headline: seed.cover.headline } };
  }
  return { ...next, recs };
}

function thumbStamp(draft: CarouselDraft, key: SlideKey) {
  if (key === "cover") {
    const crop = draft.cover.crop;
    return `cover:${draft.cover.image}:${draft.cover.headline}:${crop.x}:${crop.y}:${crop.zoom}:${draft.cover.layout}`;
  }
  if (key === "author") {
    return `author:${draft.author.photo}:${draft.author.cover}:${draft.author.name}:${draft.author.bio}`;
  }
  const rec = draft.recs.find((row) => row.id === key);
  if (!rec) return key;
  const crop = rec.crop;
  return `${rec.id}:${rec.image}:${rec.title}:${rec.template}:${rec.backdrop}:${crop.x}:${crop.y}:${crop.zoom}:${rec.description}`;
}

function LiveSlide({
  draft,
  slide,
  frameRef,
}: {
  draft: CarouselDraft;
  slide: SlideKey;
  frameRef?: (node: HTMLDivElement | null) => void;
}) {
  const spotlight = draft.kind === "spotlight";
  if (slide === "cover") {
    return spotlight ? (
      <SpotlightCoverSlide cover={draft.cover} recCount={draft.recs.length} frameRef={frameRef} />
    ) : (
      <CoverSlide cover={draft.cover} count={draft.recs.length} frameRef={frameRef} />
    );
  }
  if (slide === "author") {
    return spotlight ? (
      <SpotlightAuthorSlide
        author={{ ...draft.author, cover: draft.author.cover || draft.cover.image }}
        listingName={draft.cover.headerTitle}
        frameRef={frameRef}
      />
    ) : (
      <AuthorSlide author={draft.author} frameRef={frameRef} />
    );
  }
  const rec = draft.recs.find((row) => row.id === slide);
  if (!rec) return null;
  const index = draft.recs.findIndex((row) => row.id === rec.id) + 1;
  if (spotlight) {
    return (
      <SpotlightStorySlide
        rec={rec}
        index={index - 1}
        recCount={draft.recs.length}
        listingName={draft.cover.headerTitle || ""}
        frameRef={frameRef}
      />
    );
  }
  return <RecommendationSlide rec={rec} index={index} total={draft.recs.length} frameRef={frameRef} />;
}

function measureOverflow(bank: HTMLElement | null, keys: SlideKey[]) {
  if (!bank) return [];
  const frames = Array.from(bank.querySelectorAll<HTMLElement>(".cr-ig-frame"));
  const hits: string[] = [];
  frames.forEach((frame, index) => {
    const slide = keys[index];
    if (!slide) return;
    frame.querySelectorAll<HTMLElement>("[data-ig-fit]").forEach((node) => {
      const clamp = getComputedStyle(node).webkitLineClamp;
      if (clamp && clamp !== "none") return;
      const clipped =
        node.scrollHeight > node.clientHeight + 14 || node.scrollWidth > node.clientWidth + 18;
      if (clipped) hits.push(`${slide}::${node.dataset.igFit || "copy"}`);
    });
  });
  return hits;
}

export function CarouselWorkspace({
  open,
  onClose,
  guideId,
  title,
  intro,
  items,
  author,
  place,
  savedDraft,
  events = [],
  spotlight,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  guideId: string;
  title: string;
  intro: string;
  items: GuideDraftItem[];
  author: GuideAuthor | null;
  place: string;
  savedDraft: unknown;
  events?: CarouselEventSource[];
  onSaved?: (draft: CarouselDraft) => void;
  spotlight?: {
    listing: SpotlightListingDetails | null;
    photos: SpotlightPhoto[];
    cover: SpotlightCover;
    story: SpotlightSection[];
  };
}) {
  const seed = useMemo(() => {
    if (spotlight) {
      return seedSpotlightCarouselDraft({
        title,
        intro,
        author,
        listing: spotlight.listing,
        photos: spotlight.photos,
        cover: spotlight.cover,
        story: spotlight.story,
      });
    }
    const next = seedCarouselDraft({ title, intro, items, author, place });
    const extra = events
      .filter((event) => !next.recs.some((rec) => rec.sourceId === event.id))
      .map(seedRecFromEvent);
    return extra.length ? { ...next, recs: [...next.recs, ...extra] } : next;
  }, [title, intro, items, author, place, events, spotlight]);
  const [draft, setDraft] = useState<CarouselDraft>(() => hydrateCarousel(savedDraft, seed, title));
  const [history, setHistory] = useState<CarouselDraft[]>([]);
  const [future, setFuture] = useState<CarouselDraft[]>([]);
  const [slide, setSlide] = useState<SlideKey>("cover");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const draftRef = useRef<CarouselDraft>(draft);
  const [preview, setPreview] = useState(false);
  const [overflow, setOverflow] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [downloads, setDownloads] = useState<{ name: string; href: string }[]>([]);
  const [compactAuthorAck, setCompactAuthorAck] = useState(false);
  const [focusField, setFocusField] = useState("");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const bankRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<number | null>(null);
  const dragRec = useRef<string | null>(null);
  const sessionOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      sessionOpen.current = false;
      return;
    }
    if (sessionOpen.current) return;
    sessionOpen.current = true;
    setDraft(hydrateCarousel(savedDraft, seed, title));
    setHistory([]);
    setFuture([]);
    setSlide("cover");
    setSaveState("saved");
  }, [open, savedDraft, seed, title]);

  draftRef.current = draft;

  const persist = useCallback(async (value?: CarouselDraft) => {
    const payload = value ?? draftRef.current;
    setSaveState("saving");
    const result = await saveGuideCarousel(guideId, payload);
    if (result.ok) {
      onSaved?.(payload);
      setSaveState("saved");
      return true;
    }
    setSaveState("error");
    setMessage(result.error || "Could not save that carousel.");
    return false;
  }, [guideId, onSaved]);

  const commit = useCallback((next: CarouselDraft | ((prev: CarouselDraft) => CarouselDraft)) => {
    setDraft((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      setHistory((stack) => [...stack.slice(-29), prev]);
      setFuture([]);
      setSaveState("unsaved");
      return value;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist();
    }, 900);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [draft, open, persist]);

  useEffect(() => {
    const slideKeys: SlideKey[] = ["cover", ...draft.recs.map((row) => row.id), "author"];
    const id = window.requestAnimationFrame(() => setOverflow(measureOverflow(bankRef.current, slideKeys)));
    return () => window.cancelAnimationFrame(id);
  }, [draft]);

  useEffect(() => {
    if (!focusField) return;
    const node = document.getElementById(`cf-${focusField}`);
    node?.scrollIntoView({ block: "center" });
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
      node.focus();
    }
  }, [focusField, slide]);

  const issues = useMemo(() => {
    const list = validateCarousel(draft, overflow);
    return list.filter((issue) => {
      if (compactAuthorAck && issue.id === "author-photo") return false;
      if (issue.level === "warn" && draft.acknowledged.includes(issue.id)) return false;
      return true;
    });
  }, [draft, overflow, compactAuthorAck]);
  const blocking = issues.filter((issue) => issue.level === "error");
  const rec = draft.recs.find((row) => row.id === slide) ?? null;
  const allPhotos = [...new Set(draft.recs.flatMap((row) => row.photos))];
  const slug = exportFileSlug(title);
  const keys: SlideKey[] = ["cover", ...draft.recs.map((row) => row.id), "author"];
  const weekendLeft = issues.filter((issue) => issue.id.endsWith("-avail")).length;

  function patchCover(patch: Partial<CarouselCover>) {
    commit((prev) => ({ ...prev, cover: { ...prev.cover, ...patch } }));
  }

  function patchAuthor(patch: Partial<CarouselAuthor>) {
    commit((prev) => ({ ...prev, author: { ...prev.author, ...patch } }));
  }

  function patchRec(id: string, patch: Partial<CarouselRec>, customKeys: (keyof CarouselRec)[] = []) {
    commit((prev) => ({
      ...prev,
      recs: prev.recs.map((row) => {
        if (row.id !== id) return row;
        const custom = { ...row.custom };
        customKeys.forEach((key) => {
          custom[key as keyof typeof custom] = true;
        });
        return { ...row, ...patch, custom };
      }),
    }));
  }

  function resetRecField(id: string, field: keyof CarouselRec) {
    const fresh = seed.recs.find((row) => row.id === id);
    if (!fresh) return;
    commit((prev) => ({
      ...prev,
      recs: prev.recs.map((row) => {
        if (row.id !== id) return row;
        const custom = { ...row.custom };
        delete custom[field as keyof typeof custom];
        return { ...row, [field]: fresh[field], custom };
      }),
    }));
  }

  function undo() {
    setHistory((stack) => {
      if (!stack.length) return stack;
      const prev = stack[stack.length - 1];
      setDraft((current) => {
        setFuture((next) => [current, ...next]);
        return prev;
      });
      return stack.slice(0, -1);
    });
  }

  function redo() {
    setFuture((stack) => {
      if (!stack.length) return stack;
      const [next, ...rest] = stack;
      setDraft((current) => {
        setHistory((prev) => [...prev, current]);
        return next;
      });
      return rest;
    });
  }

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    commit((prev) => {
      const recs = [...prev.recs];
      const from = recs.findIndex((row) => row.id === fromId);
      const to = recs.findIndex((row) => row.id === toId);
      if (from < 0 || to < 0) return prev;
      const [moved] = recs.splice(from, 1);
      recs.splice(to, 0, moved);
      const headline = /^\d+\s+Weekend\s+Adventures$/i.test(prev.cover.headline.replace(/\n/g, " "))
        ? `${recs.length} Weekend\nAdventures`
        : prev.cover.headline;
      return { ...prev, recs, cover: { ...prev.cover, headline } };
    });
  }

  const slideCap = 2 + draft.recs.length;
  const canAddPost = slideCap < IG_CAROUSEL_MAX;

  function countHeadline(count: number, current: string) {
    return /^\d+\s+Weekend\s+Adventures$/i.test(current.replace(/\n/g, " "))
      ? `${count} Weekend\nAdventures`
      : current;
  }

  function addPost() {
    if (!canAddPost) return;
    const photos = [...new Set([draft.cover.image, ...draft.recs.flatMap((row) => row.photos)])].filter(Boolean);
    const next = createCarouselPost(photos, draft.cover.geoLabel.replace(/^Near\s+/i, "").replace(/\.$/, ""), draft.kind === "spotlight");
    commit((prev) => ({
      ...prev,
      recs: [...prev.recs, next],
      cover: { ...prev.cover, headline: countHeadline(prev.recs.length + 1, prev.cover.headline) },
    }));
    setSlide(next.id);
  }

  function removePost(id: string) {
    const rec = draft.recs.find((row) => row.id === id);
    if (!rec) return;
    commit((prev) => {
      const recs = prev.recs.filter((row) => row.id !== id);
      return {
        ...prev,
        recs,
        omitted: [...new Set([...(prev.omitted ?? []), rec.id, rec.sourceId].filter(Boolean))],
        cover: { ...prev.cover, headline: countHeadline(recs.length, prev.cover.headline) },
      };
    });
    if (slide === id) setSlide("cover");
  }

  async function closeDesk() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    await persist();
    onClose();
  }

  async function exportSlides(all: boolean) {
    if (busy) return;
    if (blocking.length) {
      setMessage(blocking[0].message);
      return;
    }
    const bank = bankRef.current;
    if (!bank) return;
    setBusy(true);
    setMessage("");
    try {
      const frames = Array.from(bank.querySelectorAll<HTMLElement>(".cr-ig-frame"));
      const chosen = all ? frames : frames.filter((_, index) => keys[index] === slide);
      const files: { name: string; blob: Blob }[] = [];
      for (let index = 0; index < chosen.length; index += 1) {
        const blob = await captureIgSlide(chosen[index]);
        const number = String((all ? index : keys.indexOf(slide)) + 1).padStart(2, "0");
        files.push({ name: `${slug}-${number}.png`, blob });
      }
      const links = files.map((file) => ({ name: file.name, href: URL.createObjectURL(file.blob) }));
      setDownloads((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.href));
        return links;
      });
      if (all && files.length > 1) {
        const zip = new JSZip();
        files.forEach((file) => zip.file(file.name, file.blob));
        const packed = await zip.generateAsync({ type: "blob" });
        downloadBlob(packed, `${slug}-carousel.zip`);
      } else if (files[0]) {
        downloadBlob(files[0].blob, files[0].name);
      }
      setMessage(all ? "Carousel exported." : "Slide exported.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className={`carousel-desk${preview ? " is-preview" : ""}`} role="dialog" aria-modal="true" aria-label="Carousel editor">
      <header className="carousel-desk-bar">
        <h1>Instagram carousel</h1>
        <p className="carousel-save">
          {saveState === "saving"
            ? "Saving…"
            : saveState === "error"
              ? "Save failed"
              : saveState === "unsaved"
                ? "Unsaved changes"
                : "Saved to draft"}
        </p>
        <div className="carousel-desk-bar-actions">
          <button type="button" className="btn btn-ghost" onClick={undo} disabled={!history.length}>Undo</button>
          <button type="button" className="btn btn-ghost" onClick={redo} disabled={!future.length}>Redo</button>
          <button type="button" className="btn btn-secondary" onClick={() => setPreview((value) => !value)}>
            {preview ? "Edit slides" : "Preview carousel"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saveState === "saving"}
            onClick={() => void persist()}
          >
            Save draft
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy || blocking.length > 0} onClick={() => void exportSlides(false)}>
            Download this slide
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || blocking.length > 0} onClick={() => void exportSlides(true)}>
            {busy ? "Exporting…" : "Download all"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void closeDesk()}>Close</button>
        </div>
      </header>

      {preview ? (
        <div className="carousel-desk-body">
          <div className="carousel-preview-strip">
            {keys.map((key) => (
              <button key={key} type="button" className="carousel-preview-card" onClick={() => { setSlide(key); setPreview(false); }}>
                <LiveSlide draft={draft} slide={key} />
                <span>Edit this slide</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="carousel-desk-body">
          <aside className="carousel-thumbs">
            {keys.map((key) => {
              const post = key !== "cover" && key !== "author";
              return (
                <div key={key} className={`carousel-thumb-wrap${slide === key ? " is-on" : ""}`}>
                  {key === "author" ? (
                    <button
                      type="button"
                      className="carousel-thumb-add"
                      disabled={!canAddPost}
                      onClick={addPost}
                    >
                      + Add post
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`carousel-thumb${slide === key ? " is-on" : ""}`}
                    draggable={post}
                    onDragStart={() => {
                      dragRec.current = key;
                    }}
                    onDragOver={(event) => {
                      if (post) event.preventDefault();
                    }}
                    onDrop={() => {
                      if (dragRec.current && post) reorder(dragRec.current, key);
                      dragRec.current = null;
                    }}
                    onClick={() => setSlide(key)}
                  >
                    <div className="carousel-thumb-scale">
                      <LiveSlide key={thumbStamp(draft, key)} draft={draft} slide={key} />
                    </div>
                    <span className="carousel-thumb-label">
                      {key === "cover" ? "Cover" : key === "author" ? "Author" : recTitle(draft, key)}
                    </span>
                  </button>
                  {post ? (
                    <button
                      type="button"
                      className="carousel-thumb-remove"
                      aria-label={`Remove ${recTitle(draft, key)}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removePost(key);
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })}
          </aside>

          <div className="carousel-stage">
            <div className="carousel-stage-scale" ref={stageRef}>
              <LiveSlide draft={draft} slide={slide} />
            </div>
          </div>

          <aside className="carousel-inspector">
            {slide === "cover" ? (
              <CoverInspector
                cover={draft.cover}
                photos={allPhotos}
                count={draft.recs.length}
                spotlight={draft.kind === "spotlight"}
                onChange={patchCover}
              />
            ) : null}
            {rec ? (
              <RecInspector
                rec={rec}
                seed={seed.recs.find((row) => row.id === rec.id)}
                events={events}
                spotlight={draft.kind === "spotlight"}
                onChange={(patch, keysToMark) => patchRec(rec.id, patch, keysToMark)}
                onReset={(field) => resetRecField(rec.id, field)}
                onAddEvent={(event) => commit((prev) => ({ ...prev, recs: [...prev.recs, seedRecFromEvent(event)] }))}
                onRemove={() => removePost(rec.id)}
              />
            ) : null}
            {slide === "author" ? (
              <AuthorInspector
                author={draft.author}
                assigned={seed.author}
                spotlight={draft.kind === "spotlight"}
                onChange={patchAuthor}
                onReset={() => patchAuthor(seed.author)}
                onCompact={() => {
                  setCompactAuthorAck(true);
                  patchAuthor({ compactLayout: true });
                }}
              />
            ) : null}

            <section className="carousel-issues">
              <h2>Checks</h2>
              <p className="muted">Tap a check to open the slide and the field that needs attention.</p>
              {weekendLeft > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    commit((prev) => ({
                      ...prev,
                      recs: prev.recs.map((row) =>
                        row.kind === "activity" ? { ...row, availabilityChecked: true } : row,
                      ),
                    }))
                  }
                >
                  Confirm all activities for this weekend
                </button>
              ) : null}
              {issues.length === 0 ? <p className="muted">Ready to export.</p> : null}
              {issues.map((issue) => (
                <div key={issue.id} className={`carousel-issue${issue.level === "warn" ? " is-warn" : ""}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSlide(issue.slide);
                      setFocusField(issue.field ?? "");
                    }}
                  >
                    {issue.level === "error" ? "Fix" : "Review"} · {issue.message}
                    {issue.hint ? <small>{issue.hint}</small> : null}
                  </button>
                  {issue.level === "warn" ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        commit((prev) => ({
                          ...prev,
                          acknowledged: [...new Set([...prev.acknowledged, issue.id])],
                        }))
                      }
                    >
                      Looks right
                    </button>
                  ) : null}
                </div>
              ))}
              {message ? <p>{message}</p> : null}
              {downloads.map((file) => (
                <p key={file.name}>
                  <a href={file.href} download={file.name}>Save {file.name}</a>
                </p>
              ))}
            </section>
          </aside>
        </div>
      )}

      <div className="cr-ig-capture-bank" ref={bankRef} aria-hidden>
        {keys.map((key) => (
          <LiveSlide key={key} draft={draft} slide={key} />
        ))}
      </div>
    </div>
  );
}

function recTitle(draft: CarouselDraft, id: string) {
  const index = draft.recs.findIndex((row) => row.id === id);
  return `${String(index + 1).padStart(2, "0")} ${draft.recs[index]?.title ?? "Recommendation"}`;
}

function CoverInspector({
  cover,
  photos,
  count,
  spotlight,
  onChange,
}: {
  cover: CarouselCover;
  photos: string[];
  count: number;
  spotlight?: boolean;
  onChange: (patch: Partial<CarouselCover>) => void;
}) {
  const crops = cover.collageCrops ?? [cover.crop, cover.crop, cover.crop];
  function setSlot(index: number, src: string) {
    const collage = [...cover.collage] as [string, string, string];
    collage[index] = src;
    onChange({ collage, image: index === 0 ? src : cover.image });
  }
  function setSlotCrop(index: number, crop: CarouselCrop) {
    const next = [...crops] as [CarouselCrop, CarouselCrop, CarouselCrop];
    next[index] = crop;
    onChange({ collageCrops: next, crop: index === 0 ? crop : cover.crop });
  }
  return (
    <>
      <h2>Cover</h2>
      <p className="muted">{count} story slides · {count + 2} slides</p>
      {spotlight ? (
        <label>
          Header title
          <input value={cover.headerTitle ?? ""} onChange={(e) => onChange({ headerTitle: e.target.value })} />
        </label>
      ) : null}
      <label>
        Series label
        <input id="cf-seriesLabel" value={cover.seriesLabel} onChange={(e) => onChange({ seriesLabel: e.target.value })} />
      </label>
      <label>
        Cover headline
        <textarea id="cf-headline" value={cover.headline} onChange={(e) => onChange({ headline: e.target.value })} />
      </label>
      <label>
        Supporting line
        <textarea value={cover.supporting} onChange={(e) => onChange({ supporting: e.target.value })} />
      </label>
      <label>
        Geographic label
        <input id="cf-geoLabel" value={cover.geoLabel} onChange={(e) => onChange({ geoLabel: e.target.value })} />
      </label>
      {spotlight ? null : (
        <>
          <p>Weekend on the cover</p>
          <p className="muted">The dates this carousel is promoting. Not how long the website guide stays live.</p>
          <div className="carousel-dates">
            <label>
              From
              <input
                id="cf-dateFrom"
                type="date"
                value={cover.dateFrom}
                onChange={(e) => onChange({ dateFrom: e.target.value, dateTo: cover.dateTo || e.target.value })}
              />
            </label>
            <label>
              To
              <input
                id="cf-dateTo"
                type="date"
                value={cover.dateTo}
                min={cover.dateFrom || undefined}
                onChange={(e) => onChange({ dateTo: e.target.value })}
              />
            </label>
          </div>
        </>
      )}
      <label>
        Swipe prompt
        <input value={cover.swipePrompt} onChange={(e) => onChange({ swipePrompt: e.target.value })} />
      </label>
      {spotlight ? null : (
      <label>
        Layout
        <select value={cover.layout} onChange={(e) => onChange({ layout: e.target.value as CarouselCover["layout"] })}>
          <option value="hero">Hero photograph</option>
          <option value="collage">Three-photo collage</option>
        </select>
      </label>
      )}
      {cover.layout === "hero" || spotlight ? (
        <PhotoCrop
          label="Cover photograph"
          photos={photos}
          selected={cover.image}
          crop={cover.crop}
          onSelect={(src) => onChange({ image: src })}
          onCrop={(crop) => onChange({ crop })}
        />
      ) : (
        [0, 1, 2].map((index) => (
          <PhotoCrop
            key={index}
            label={`Collage photo ${index + 1}`}
            photos={photos}
            selected={cover.collage[index]}
            crop={crops[index]}
            onSelect={(src) => setSlot(index, src)}
            onCrop={(crop) => setSlotCrop(index, crop)}
          />
        ))
      )}
    </>
  );
}

function PhotoCrop({
  label,
  photos,
  selected,
  crop,
  onSelect,
  onCrop,
}: {
  label: string;
  photos: string[];
  selected: string;
  crop: CarouselCrop;
  onSelect: (src: string) => void;
  onCrop: (crop: CarouselCrop) => void;
}) {
  return (
    <section className="carousel-slot">
      <p>{label}</p>
      <div className="carousel-photos">
        {photos.map((src) => (
          <button key={src} type="button" className={selected === src ? "is-on" : ""} onClick={() => onSelect(src)}>
            <img src={src} alt="" />
          </button>
        ))}
      </div>
      <label>
        Zoom
        <input type="range" min="1" max="2.4" step="0.05" value={crop.zoom} onChange={(e) => onCrop({ ...crop, zoom: Number(e.target.value) })} />
      </label>
      <label>
        Position X
        <input type="range" min="0" max="100" value={crop.x} onChange={(e) => onCrop({ ...crop, x: Number(e.target.value) })} />
      </label>
      <label>
        Position Y
        <input type="range" min="0" max="100" value={crop.y} onChange={(e) => onCrop({ ...crop, y: Number(e.target.value) })} />
      </label>
      <button type="button" className="btn btn-ghost" onClick={() => onCrop({ x: 50, y: 50, zoom: 1 })}>
        Reset crop
      </button>
    </section>
  );
}

function WordRibbon({
  label,
  style,
  min,
  max,
  onChange,
}: {
  label: string;
  style: ReturnType<typeof spotlightTypeStyle>;
  min: number;
  max: number;
  onChange: (patch: TypeStyle) => void;
}) {
  return (
    <div className="word-ribbon" role="toolbar" aria-label={`${label} formatting`}>
      <label className="word-ribbon-size">
        Size
        <input
          type="number"
          min={min}
          max={max}
          value={style.size}
          onChange={(e) => onChange({ size: Number(e.target.value) })}
        />
      </label>
      <div className="word-ribbon-group">
        <button type="button" className={style.bold ? "is-on" : ""} aria-pressed={style.bold} onClick={() => onChange({ bold: !style.bold })}>
          B
        </button>
        <button type="button" className={`is-italic${style.italic ? " is-on" : ""}`} aria-pressed={style.italic} onClick={() => onChange({ italic: !style.italic })}>
          I
        </button>
        <button type="button" className={`is-underline${style.underline ? " is-on" : ""}`} aria-pressed={style.underline} onClick={() => onChange({ underline: !style.underline })}>
          U
        </button>
      </div>
      <div className="word-ribbon-group" aria-label="Alignment">
        {(["left", "centre", "right"] as TypeAlign[]).map((value) => (
          <button key={value} type="button" className={style.align === value ? "is-on" : ""} onClick={() => onChange({ align: value })}>
            {value === "left" ? "Left" : value === "centre" ? "Centre" : "Right"}
          </button>
        ))}
      </div>
      <label className="word-ribbon-space">
        Line
        <select value={String(style.lineSpace)} onChange={(e) => onChange({ lineSpace: Number(e.target.value) })}>
          <option value="1">1.0</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">2.0</option>
        </select>
      </label>
      <div className="word-ribbon-group" aria-label="Font colour">
        {(["snow", "jade", "night"] as SpotlightInk[]).map((value) => (
          <button
            key={value}
            type="button"
            className={`carousel-ink${style.ink === value ? " is-on" : ""}`}
            data-ink={value}
            aria-label={value}
            onClick={() => onChange({ ink: value })}
          />
        ))}
      </div>
    </div>
  );
}

function RecInspector({
  rec,
  seed,
  events,
  spotlight,
  onChange,
  onReset,
  onAddEvent,
  onRemove,
}: {
  rec: CarouselRec;
  seed?: CarouselRec;
  events: CarouselEventSource[];
  spotlight?: boolean;
  onChange: (patch: Partial<CarouselRec>, custom: (keyof CarouselRec)[]) => void;
  onReset: (field: keyof CarouselRec) => void;
  onAddEvent: (event: CarouselEventSource) => void;
  onRemove?: () => void;
}) {
  const words = wordCount(rec.description);
  const template = spotlight ? spotlightTemplate(rec) : null;
  const showCopy = template !== "photo";
  const backdrop = spotlight ? spotlightBackdrop(rec) : "night";
  const showPhoto = template !== "copy" || backdrop === "image";
  const headingStyle = spotlightTypeStyle(rec, "heading");
  const packStyle = spotlightTypeStyle(rec, "pack");
  const bodyStyle = spotlightTypeStyle(rec, "body");
  const postAlign = spotlightPostAlign(rec);
  return (
    <>
      <h2>
        {spotlight
          ? rec.role === "pack"
            ? "Pack slide"
            : rec.kind === "custom"
              ? "Extra post"
              : "Story slide"
          : rec.kind === "event"
            ? "Event"
            : rec.kind === "custom"
              ? "Extra post"
              : "Activity"}
      </h2>
      {spotlight ? (
        <>
          <p>Template</p>
          <div className="carousel-templates" role="group" aria-label="Slide template">
            {(
              [
                ["combined", "Combined"],
                ["copy", "Write-up"],
                ["photo", "Photograph"],
                ["overlay", "Type on photo"],
              ] as [SpotlightSlideTemplate, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={template === value ? "is-on" : ""}
                onClick={() => onChange({ template: value }, ["template"])}
              >
                {label}
              </button>
            ))}
          </div>
          {template === "copy" ? (
            <>
              <p>Background</p>
              <div className="carousel-templates" role="group" aria-label="Slide background">
                {(["night", "colour", "image"] as SlideBackdrop[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={backdrop === value ? "is-on" : ""}
                    onClick={() => onChange({ backdrop: value }, ["backdrop"])}
                  >
                    {value === "night" ? "Grey" : value === "colour" ? "Colour" : "Greyed image"}
                  </button>
                ))}
              </div>
              {backdrop === "colour" ? (
                <div className="word-ribbon-group" aria-label="Background colour">
                  {BACKDROP_COLOURS.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={(rec.backdropColour || "#45A67F") === row.value ? "is-on" : ""}
                      onClick={() => onChange({ backdropColour: row.value }, ["backdropColour"])}
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {showCopy ? (
            <>
              <p>Page alignment</p>
              <div className="word-ribbon-group" aria-label="Page alignment">
                {(["top", "centre", "bottom"] as PostAlign[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={postAlign === value ? "is-on" : ""}
                    onClick={() => onChange({ postAlign: value }, [])}
                  >
                    {value === "top" ? "Top" : value === "centre" ? "Centre" : "Bottom"}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          <Field label="Slide heading" custom={Boolean(rec.custom.title)} onReset={() => onReset("title")}>
            <WordRibbon
              label="Heading"
              style={headingStyle}
              min={HEADING_SIZE_MIN}
              max={HEADING_SIZE_MAX}
              onChange={(patch) => onChange({ headingStyle: { ...rec.headingStyle, ...patch } }, ["headingStyle"])}
            />
            <textarea id="cf-title" value={rec.title} onChange={(e) => onChange({ title: e.target.value }, ["title"])} />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={rec.role === "pack"}
              onChange={(e) => onChange({ role: e.target.checked ? "pack" : "story" }, ["role"])}
            />{" "}
            Pack-for-the-day slide
          </label>
          {rec.role === "pack" && showCopy ? (
            <Field label="Pack line" custom={Boolean(rec.custom.tip)} onReset={() => onReset("tip")}>
              <WordRibbon
                label="Pack line"
                style={packStyle}
                min={COPY_SIZE_MIN}
                max={HEADING_SIZE_MAX}
                onChange={(patch) => onChange({ packStyle: { ...rec.packStyle, ...patch } }, ["packStyle"])}
              />
              <textarea id="cf-pack" value={rec.tip} onChange={(e) => onChange({ tip: e.target.value }, ["tip"])} />
            </Field>
          ) : null}
        </>
      ) : (
      <Field
        label="Social title"
        custom={Boolean(rec.custom.title)}
        onReset={() => onReset("title")}
      >
        <input value={rec.title} onChange={(e) => onChange({ title: e.target.value }, ["title"])} />
      </Field>
      )}
      {showCopy ? (
      <Field
        label="Social description"
        hint={
          spotlight
            ? `${words} words. Line breaks stay.`
            : `${words} words · aim for 15–25. Write one complete sentence.`
        }
        custom={Boolean(rec.custom.description)}
        onReset={() => onReset("description")}
      >
        {spotlight ? (
          <WordRibbon
            label="Paragraph"
            style={bodyStyle}
            min={COPY_SIZE_MIN}
            max={COPY_SIZE_MAX}
            onChange={(patch) => onChange({ copyStyle: { ...rec.copyStyle, ...patch } }, ["copyStyle"])}
          />
        ) : null}
        <textarea id="cf-description" value={rec.description} onChange={(e) => onChange({ description: e.target.value }, ["description"])} />
      </Field>
      ) : null}
      {spotlight ? null : (
      <Field label="Display location" custom={Boolean(rec.custom.location)} onReset={() => onReset("location")}>
        <input value={rec.location} onChange={(e) => onChange({ location: e.target.value }, ["location"])} />
      </Field>
      )}
      {spotlight ? null : (
      <>
      <Field label="Category" custom={Boolean(rec.custom.categoryKey)} onReset={() => onReset("categoryKey")}>
        <select
          value={rec.categoryKey}
          onChange={(e) => {
            const next = APPROVED_CATEGORIES.find((row) => row.key === e.target.value);
            onChange({ categoryKey: e.target.value, categoryTitle: next?.title ?? rec.categoryTitle }, ["categoryKey", "categoryTitle"]);
          }}
        >
          {APPROVED_CATEGORIES.map((row) => (
            <option key={row.key} value={row.key}>{row.title}</option>
          ))}
        </select>
      </Field>
      <label>
        Price amount
        <input
          type="number"
          value={rec.priceAmount ?? ""}
          onChange={(e) => onChange({ priceAmount: e.target.value === "" ? null : Number(e.target.value) }, ["priceAmount"])}
        />
      </label>
      <label>
        Price basis
        <select value={rec.priceBasis} onChange={(e) => onChange({ priceBasis: e.target.value as PriceBasis }, ["priceBasis"])}>
          {PRICE_BASES.map((basis) => (
            <option key={basis} value={basis}>{basis}</option>
          ))}
        </select>
      </label>
      <label>
        Price qualifier
        <input value={rec.priceNote} onChange={(e) => onChange({ priceNote: e.target.value }, ["priceNote"])} placeholder="Excludes equipment hire" />
      </label>
      <label>
        Practical tip
        <input value={rec.tip} onChange={(e) => onChange({ tip: e.target.value }, ["tip"])} />
      </label>
      {rec.kind === "event" ? (
        <>
          <label>
            Event date
            <input type="date" value={rec.eventDate} onChange={(e) => onChange({ eventDate: e.target.value }, ["eventDate"])} />
          </label>
          <label>
            Start
            <input type="time" value={rec.eventStart} onChange={(e) => onChange({ eventStart: e.target.value }, ["eventStart"])} />
          </label>
          <label>
            End
            <input type="time" value={rec.eventEnd} onChange={(e) => onChange({ eventEnd: e.target.value }, ["eventEnd"])} />
          </label>
        </>
      ) : (
        <label>
          <input
            type="checkbox"
            id="cf-availabilityChecked"
            checked={rec.availabilityChecked}
            onChange={(e) => onChange({ availabilityChecked: e.target.checked }, ["availabilityChecked"])}
          />{" "}
          Confirmed for this weekend
        </label>
      )}
      </>
      )}
      {showPhoto ? (
        <>
      <p>Photograph</p>
      <div className="carousel-photos">
        {rec.photos.map((src) => (
          <button key={src} type="button" className={rec.image === src ? "is-on" : ""} onClick={() => onChange({ image: src }, ["image"])}>
            <img src={src} alt="" />
          </button>
        ))}
      </div>
      <label>
        Zoom
        <input
          type="range"
          min="1"
          max="2.4"
          step="0.05"
          value={rec.crop.zoom}
          onChange={(e) => onChange({ crop: { ...rec.crop, zoom: Number(e.target.value) } }, [])}
        />
      </label>
      <label>
        Position X
        <input type="range" min="0" max="100" value={rec.crop.x} onChange={(e) => onChange({ crop: { ...rec.crop, x: Number(e.target.value) } }, [])} />
      </label>
      <label>
        Position Y
        <input type="range" min="0" max="100" value={rec.crop.y} onChange={(e) => onChange({ crop: { ...rec.crop, y: Number(e.target.value) } }, [])} />
      </label>
      <button type="button" className="btn btn-ghost" onClick={() => onChange({ crop: { x: 50, y: 50, zoom: 1 } }, [])}>
        Reset crop
      </button>
        </>
      ) : null}
      {seed && seed.description !== rec.description && rec.custom.description ? (
        <p className="muted">Directory copy has changed. Reset the description to review it.</p>
      ) : null}
      {onRemove ? (
        <button type="button" className="btn btn-ghost" onClick={onRemove}>
          Remove this post
        </button>
      ) : null}
      {!spotlight && events.length ? (
        <label>
          Add linked event
          <select defaultValue="" onChange={(e) => {
            const event = events.find((row) => row.id === e.target.value);
            if (event) onAddEvent(event);
            e.currentTarget.value = "";
          }}>
            <option value="">Choose an event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}

function AuthorInspector({
  author,
  assigned,
  spotlight,
  onChange,
  onReset,
  onCompact,
}: {
  author: CarouselAuthor;
  assigned: CarouselAuthor;
  spotlight?: boolean;
  onChange: (patch: Partial<CarouselAuthor>) => void;
  onReset: () => void;
  onCompact: () => void;
}) {
  return (
    <>
      <h2>Author closing slide</h2>
      {assigned.name ? (
        <p className="muted">Assigned on this guide: {assigned.name}</p>
      ) : (
        <p className="muted">Pick an author on the guide, then it will appear here.</p>
      )}
      {spotlight ? (
        <p className="muted">
          {author.cover
            ? "Cover photo sits behind the portrait, with the Jade band for the close."
            : "Add a cover on the author card, or this slide will use the guide cover."}
        </p>
      ) : author.cover ? (
        <p className="muted">Cover photo from the author card is used behind the portrait.</p>
      ) : (
        <p className="muted">This author has no cover photo yet. Add one on their author card.</p>
      )}
      <button type="button" className="btn btn-secondary" onClick={onReset} disabled={!assigned.name}>
        Use assigned author
      </button>
      <label>
        Kicker
        <input value={author.kicker} onChange={(e) => onChange({ kicker: e.target.value })} />
      </label>
      <label>
        Display name
        <input id="cf-name" value={author.name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      <label>
        Tagline
        <input value={author.tagline ?? ""} onChange={(e) => onChange({ tagline: e.target.value })} />
      </label>
      <label>
        Social bio
        <textarea id="cf-bio" value={author.bio} onChange={(e) => onChange({ bio: e.target.value })} />
      </label>
      <label>
        Handle
        <input value={author.handle} onChange={(e) => onChange({ handle: e.target.value })} />
      </label>
      <label>
        Closing line
        <textarea value={author.closing} onChange={(e) => onChange({ closing: e.target.value })} />
      </label>
      <label>
        Primary action
        <input value={author.primaryAction} onChange={(e) => onChange({ primaryAction: e.target.value })} />
      </label>
      <label>
        Supporting line
        <input value={author.supportingAction} onChange={(e) => onChange({ supportingAction: e.target.value })} />
      </label>
      {spotlight ? null : (
        <button type="button" className="btn btn-ghost" onClick={onCompact}>
          Use compact author layout
        </button>
      )}
    </>
  );
}

function Field({
  label,
  hint,
  custom,
  onReset,
  children,
}: {
  label: string;
  hint?: string;
  custom?: boolean;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="carousel-field">
      <span>
        {label}
        {custom ? <span className="carousel-custom"> · customised</span> : null}
        {custom && onReset ? (
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            Reset to source
          </button>
        ) : null}
      </span>
      {children}
      {hint ? <small className="muted">{hint}</small> : null}
    </div>
  );
}
