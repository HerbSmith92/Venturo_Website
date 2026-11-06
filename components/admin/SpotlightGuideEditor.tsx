"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { applyGuideAction, saveCuratedGuide } from "@/app/admin/guide-actions";
import { CarouselWorkspace } from "@/components/admin/carousel/CarouselWorkspace";
import { StoryBuilder } from "@/components/admin/StoryBuilder";
import { SpotlightArticle } from "@/components/SpotlightArticle";
import type { GuideEditorRecord, SpotlightListingDetails } from "@/lib/control-room-guides";
import { formatDay, formatHours, formatRand } from "@/lib/control-room-shared";
import type { GuideAuthor } from "@/lib/guide-authors";
import { mapGuideAuthor } from "@/lib/guide-authors";
import { toZaLocalInput, type GuideListingPreview } from "@/lib/guide-shared";
import { INTEREST_CHIPS, type EditorCatalog } from "@/lib/listing-draft";
import { createClient } from "@/lib/supabase/client";
import {
  coverPhoto,
  emptySpotlightCover,
  mergeListingPhotos,
  newSpotlightId,
  photoPlacements,
  type SpotlightPhoto,
  type SpotlightSection,
  type SpotlightVisitInfo,
} from "@/lib/spotlight";

function asVisit(listing: SpotlightListingDetails | null): SpotlightVisitInfo | null {
  if (!listing) return null;
  return {
    name: listing.name,
    slug: listing.slug,
    area: listing.area,
    fromPrice: listing.fromPrice == null || listing.fromPrice === "" ? null : Number(listing.fromPrice),
    bookingUrl: listing.bookingUrl,
    websiteUrl: listing.websiteUrl,
    phone: listing.phone,
    bookingRequired: listing.bookingRequired,
    indoorOutdoor: listing.indoorOutdoor,
    hours: listing.hours,
  };
}

export function SpotlightGuideEditor({
  guide,
  catalog,
  authors,
  listing,
  canPublish,
  lockAuthor,
  notice,
  error,
}: {
  guide: GuideEditorRecord;
  catalog: EditorCatalog;
  authors: GuideAuthor[];
  listing: SpotlightListingDetails | null;
  canPublish: boolean;
  lockAuthor: boolean;
  notice?: string;
  error?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(guide.title === "Untitled Guide" ? "" : guide.title);
  const [intro, setIntro] = useState(guide.intro ?? "");
  const [slug, setSlug] = useState(guide.slug);
  const [authorId, setAuthorId] = useState(guide.author_id ?? "");
  const [listingId, setListingId] = useState(guide.listing_id ?? "");
  const [story, setStory] = useState(guide.story);
  const [photos, setPhotos] = useState(guide.photos);
  const [cover, setCover] = useState(guide.cover.photoId ? guide.cover : emptySpotlightCover());
  const [kindIds, setKindIds] = useState(guide.kind_ids);
  const [publishAt, setPublishAt] = useState(toZaLocalInput(guide.publish_at));
  const [expireAt, setExpireAt] = useState(toZaLocalInput(guide.expire_at));
  const [activity, setActivity] = useState(listing);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GuideListingPreview[]>([]);
  const [searching, setSearching] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(error ?? null);
  const [preview, setPreview] = useState<"desktop" | "mobile" | null>(null);
  const [carousel, setCarousel] = useState(false);
  const [carouselSaved, setCarouselSaved] = useState(guide.carousel_draft);
  const [inspect, setInspect] = useState<string | null>(null);
  const hydrated = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const author = authors.find((row) => row.id === authorId) ?? null;
  const visit = asVisit(activity);
  const inspected = photos.find((photo) => photo.id === inspect) ?? null;
  const spotlightCarousel = useMemo(
    () => ({ listing: activity, photos, cover, story }),
    [activity, photos, cover, story],
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = window.setTimeout(async () => {
      const res = await fetch(`/api/admin/guides/listings?q=${encodeURIComponent(query.trim())}`);
      const body = (await res.json()) as { listings?: GuideListingPreview[] };
      if (!cancelled) setResults(body.listings ?? []);
      if (!cancelled) setSearching(false);
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  async function linkListing(id: string) {
    setListingId(id);
    setQuery("");
    setResults([]);
    const res = await fetch(`/api/admin/guides/listings?id=${encodeURIComponent(id)}`);
    const body = (await res.json()) as { listing?: SpotlightListingDetails | null };
    const next = body.listing ?? null;
    setActivity(next);
    if (next) {
      setPhotos((current) => {
        const merged = mergeListingPhotos(current, next.media);
        setCover((prev) => {
          if (prev.photoId) return prev;
          const coverMediaId = next.media.find((item) => item.isCover)?.id;
          const preferred =
            merged.find((photo) => photo.listingMediaId === coverMediaId) ?? merged[0] ?? null;
          return preferred ? { ...prev, photoId: preferred.id } : prev;
        });
        return merged;
      });
    }
  }

  async function persist(nextStory?: SpotlightSection[]) {
    setSaveState("saving");
    const result = await saveCuratedGuide(guide.id, {
      title: title.trim() || "Untitled Guide",
      slug,
      intro,
      body: "",
      shape: "spotlight",
      author_id: authorId,
      publish_at: publishAt,
      expire_at: expireAt,
      kind_ids: kindIds,
      persona_ids: guide.persona_ids,
      scale_id: guide.scale_id ?? "",
      interest_ids: guide.interest_ids,
      items: listingId ? [{ listing_id: listingId, editorial_note: "" }] : [],
      listing_id: listingId,
      story: nextStory ?? story,
      photos,
      cover,
    });
    if (!result.ok) {
      setSaveState("error");
      setSaveError(result.error);
      return false;
    }
    setSaveState("saved");
    setSaveError(null);
    return true;
  }

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    const handle = window.setTimeout(() => {
      void persist();
    }, 1200);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, intro, slug, authorId, listingId, story, photos, cover, kindIds, publishAt, expireAt]);

  async function onUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const supabase = createClient();
    if (!supabase) return;
    const key = `${guide.id}/${newSpotlightId()}-${file.name.replace(/\s+/g, "-")}`;
    const { error: uploadError } = await supabase.storage.from("guide-spotlight").upload(key, file, { upsert: false });
    if (uploadError) {
      setSaveError(uploadError.message);
      return;
    }
    const { data } = supabase.storage.from("guide-spotlight").getPublicUrl(key);
    const photo: SpotlightPhoto = {
      id: newSpotlightId(),
      source: "upload",
      listingMediaId: null,
      url: data.publicUrl,
      alt: "",
      caption: "",
      credit: "",
      cover: false,
      gallery: false,
      instagram: false,
      focusX: 50,
      focusY: 50,
    };
    setPhotos((current) => [...current, photo]);
    setInspect(photo.id);
  }

  function patchPhoto(id: string, partial: Partial<SpotlightPhoto>) {
    setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, ...partial } : photo)));
    if (partial.cover) {
      setPhotos((current) => current.map((photo) => ({ ...photo, cover: photo.id === id })));
      setCover((current) => ({ ...current, photoId: id }));
    }
  }

  const previewAuthor = author ? mapGuideAuthor(author) : null;
  const hero = coverPhoto(photos, cover);

  return (
    <div className="spotlight-editor">
      <header className="spotlight-editor-head">
        <div>
          <p className="eyebrow">Guides / Spotlight</p>
          <h1>{title.trim() || "Untitled Spotlight"}</h1>
          <p className="muted">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Draft saved" : "Autosave on"}
            {guide.status ? ` · ${guide.status}` : ""}
          </p>
        </div>
        <div className="cr-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setPreview("desktop")}>
            Desktop preview
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setPreview("mobile")}>
            Mobile preview
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => startTransition(() => void persist())} disabled={pending}>
            Save draft
          </button>
          {guide.status !== "published" ? (
            <form action={applyGuideAction}>
              <input type="hidden" name="id" value={guide.id} />
              <input type="hidden" name="action" value="submit" />
              <button className="btn btn-secondary" type="submit">
                Submit for review
              </button>
            </form>
          ) : null}
          {canPublish ? (
            <>
              {guide.status === "review" || guide.status === "draft" || guide.status === "changes" ? (
                <form action={applyGuideAction}>
                  <input type="hidden" name="id" value={guide.id} />
                  <input type="hidden" name="action" value="request_changes" />
                  <button className="btn btn-secondary" type="submit">
                    Request changes
                  </button>
                </form>
              ) : null}
              <form action={applyGuideAction}>
                <input type="hidden" name="id" value={guide.id} />
                <input type="hidden" name="action" value="publish" />
                <button className="btn btn-primary" type="submit">
                  {publishAt ? "Schedule / Publish" : "Publish"}
                </button>
              </form>
              {guide.status !== "archived" ? (
                <form action={applyGuideAction}>
                  <input type="hidden" name="id" value={guide.id} />
                  <input type="hidden" name="action" value="archive" />
                  <button className="btn btn-secondary" type="submit">
                    Archive
                  </button>
                </form>
              ) : null}
            </>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => setCarousel(true)}>
            Generate carousel
          </button>
        </div>
      </header>
      {notice ? <p className="notice">{notice}</p> : null}
      {saveError ? <p className="error">{saveError}</p> : null}

      <div className="spotlight-editor-grid">
        <div className="spotlight-editor-main">
          <section className="spotlight-panel">
            <h2>Guide details</h2>
            <label>
              Guide title
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A little chalk. A lot of courage." />
            </label>
            <label>
              Short introduction
              <textarea value={intro} onChange={(event) => setIntro(event.target.value)} placeholder="An afternoon of first climbs & small victories." />
            </label>
            <label>
              Credited author
              <select value={authorId} onChange={(event) => setAuthorId(event.target.value)} disabled={lockAuthor}>
                <option value="">Select author</option>
                {authors.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Linked activity
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the directory" />
            </label>
            {activity ? (
              <p className="notice">
                Linked to <strong>{activity.name}</strong> · {activity.area}
              </p>
            ) : null}
            {searching ? <p className="muted">Searching…</p> : null}
            {results.length > 0 ? (
              <ul className="spotlight-listing-results">
                {results.map((row) => (
                  <li key={row.id}>
                    <button type="button" onClick={() => void linkListing(row.id)}>
                      {row.name}
                      <span>{[row.suburb, row.city].filter(Boolean).join(", ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <label>
              URL slug
              <input value={slug} onChange={(event) => setSlug(event.target.value)} />
            </label>
            <fieldset>
              <legend>Category</legend>
              <div className="cr-chip-row">
                {INTEREST_CHIPS.map((chip) => {
                  const kind = catalog.kinds.find((row) => row.key === chip.key);
                  if (!kind) return null;
                  const on = kindIds.includes(kind.id);
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      className={on ? "is-on" : undefined}
                      onClick={() => setKindIds((current) => (on ? current.filter((id) => id !== kind.id) : [...current, kind.id]))}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </section>

          <StoryBuilder
            story={story}
            photos={photos}
            cover={cover}
            guideId={guide.id}
            authorName={author?.display_name}
            saveState={saveState === "error" ? "failed" : saveState}
            saveError={saveError}
            onStoryChange={setStory}
            onPhotosChange={setPhotos}
            onPersist={persist}
            onPreviewFull={() => setPreview("desktop")}
          />
        </div>

        <aside className="spotlight-editor-side">
          <section className="spotlight-panel">
            <h2>Linked activity</h2>
            {activity ? (
              <>
                <p>
                  <strong>{activity.name}</strong>
                  <br />
                  {activity.area}
                </p>
                {activity.fromPrice != null && activity.fromPrice !== "" ? <p>Price · {formatRand(activity.fromPrice)}</p> : <p>Price · View latest pricing</p>}
                {activity.hours.length ? (
                  <ul>
                    {activity.hours.slice(0, 4).map((row) => (
                      <li key={row.dayOfWeek}>
                        {formatDay(row.dayOfWeek)} · {formatHours(row.opensAt, row.closesAt, row.isClosed)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    <a href={`/directory/${activity.slug}`}>Check opening times</a>
                  </p>
                )}
                {activity.bookingUrl ? (
                  <p>
                    <a href={activity.bookingUrl}>Booking</a>
                  </p>
                ) : null}
                <a href={`/admin/listings/${activity.id}`}>Open listing</a>
              </>
            ) : (
              <p className="muted">Link an activity to load photos &amp; practical details.</p>
            )}
          </section>

          <section className="spotlight-panel">
            <h2>Photos</h2>
            <p className="muted">Cover, gallery &amp; Instagram selections stay independent.</p>
            <div className="spotlight-media-grid">
              {photos.map((photo) => {
                const uses = photoPlacements(photo, cover);
                return (
                  <button key={photo.id} type="button" className={inspect === photo.id ? "is-on" : undefined} onClick={() => setInspect(photo.id)}>
                    <img src={photo.url} alt="" />
                    {uses.length ? <span>{uses.join(" · ")}</span> : <span>Unused</span>}
                  </button>
                );
              })}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void onUpload(event.target.files)} />
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              Upload guide photo
            </button>
            {inspected ? (
              <div className="spotlight-photo-meta">
                <img src={inspected.url} alt="" />
                <label>
                  Caption
                  <input value={inspected.caption} onChange={(event) => patchPhoto(inspected.id, { caption: event.target.value })} />
                </label>
                <label>
                  Credit
                  <input value={inspected.credit} onChange={(event) => patchPhoto(inspected.id, { credit: event.target.value })} />
                </label>
                <label>
                  Alt text
                  <input value={inspected.alt} onChange={(event) => patchPhoto(inspected.id, { alt: event.target.value })} />
                </label>
                <label>
                  Crop X
                  <input type="range" min={0} max={100} value={inspected.focusX} onChange={(event) => patchPhoto(inspected.id, { focusX: Number(event.target.value) })} />
                </label>
                <label>
                  Crop Y
                  <input type="range" min={0} max={100} value={inspected.focusY} onChange={(event) => patchPhoto(inspected.id, { focusY: Number(event.target.value) })} />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={cover.photoId === inspected.id || inspected.cover}
                    onChange={(event) => patchPhoto(inspected.id, { cover: event.target.checked })}
                  />
                  Cover image
                </label>
                <label>
                  <input type="checkbox" checked={inspected.gallery} onChange={(event) => patchPhoto(inspected.id, { gallery: event.target.checked })} />
                  Public gallery
                </label>
                <label>
                  <input type="checkbox" checked={inspected.instagram} onChange={(event) => patchPhoto(inspected.id, { instagram: event.target.checked })} />
                  Instagram slides
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setPhotos((current) => current.filter((photo) => photo.id !== inspected.id));
                    if (cover.photoId === inspected.id) setCover(emptySpotlightCover());
                    setInspect(null);
                  }}
                >
                  Remove from guide
                </button>
              </div>
            ) : null}
            {hero ? <p className="muted">Cover uses the selected crop. Headline stays over the darker edge.</p> : null}
          </section>

          <section className="spotlight-panel">
            <h2>Publishing</h2>
            <label>
              Publish at (SA time)
              <input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
            </label>
            <label>
              Expire at
              <input type="datetime-local" value={expireAt} onChange={(event) => setExpireAt(event.target.value)} />
            </label>
          </section>
        </aside>
      </div>

      {preview ? (
        <div className="spotlight-preview-modal">
          <button type="button" className="spotlight-lightbox-backdrop" aria-label="Close preview" onClick={() => setPreview(null)} />
          <div className={`spotlight-preview-frame is-${preview}`}>
            <header>
              <strong>{preview === "mobile" ? "Mobile preview" : "Desktop preview"}</strong>
              <button type="button" onClick={() => setPreview(null)}>
                Close
              </button>
            </header>
            <SpotlightArticle
              title={title}
              intro={intro}
              slug={slug}
              cover={cover}
              photos={photos}
              story={story}
              listing={visit}
              author={previewAuthor}
              compact={preview === "mobile"}
              kind={activity?.activityKindKey ?? null}
              chip={
                INTEREST_CHIPS.find((chip) => chip.key === activity?.activityKindKey)?.label ??
                null
              }
            />
          </div>
        </div>
      ) : null}

      <CarouselWorkspace
        open={carousel}
        onClose={() => setCarousel(false)}
        guideId={guide.id}
        title={title}
        intro={intro}
        items={[]}
        author={author}
        place={activity?.area || "Joburg & nearby"}
        savedDraft={carouselSaved}
        onSaved={setCarouselSaved}
        spotlight={spotlightCarousel}
      />
    </div>
  );
}
