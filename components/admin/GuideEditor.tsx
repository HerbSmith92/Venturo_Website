"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGuideEvents } from "@/app/admin/content-actions";
import { saveCuratedGuide } from "@/app/admin/guide-actions";
import { GuideActions } from "@/components/admin/GuideActions";
import { GuideExportModal } from "@/components/admin/guide-export/GuideExportModal";
import { formatRand } from "@/lib/control-room-shared";
import type { GuideEditorRecord } from "@/lib/control-room-guides";
import {
  SUGGESTED_GUIDE_TITLES,
  UNDER_PRICE_TITLE,
  guideStatusLabel,
  parseUnderPriceTitle,
  pricedGuideSummary,
  toZaLocalInput,
  underPriceTitle,
  type GuideDraft,
  type GuideListingPreview,
  type GuidePlace,
} from "@/lib/guide-shared";
import type { EditorCatalog } from "@/lib/listing-draft";

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";

const GUIDE_STEPS = [
  { key: "list", label: "The List" },
  { key: "audience", label: "Audience" },
  { key: "window", label: "Window" },
  { key: "spots", label: "Recommendations" },
  { key: "events", label: "Linked Events" },
] as const;

type GuideStepKey = (typeof GUIDE_STEPS)[number]["key"];

function windowSummary(publish: string, expire: string) {
  const short = (value: string) => value.replace("T", " ").slice(0, 16);
  if (publish && expire) return `${short(publish)} – ${short(expire)}`;
  if (publish) return `From ${short(publish)}`;
  if (expire) return `Until ${short(expire)}`;
  return "Evergreen";
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
  linkedEventIds,
  places,
}: {
  guide: GuideEditorRecord;
  catalog: EditorCatalog;
  notice?: string;
  error?: string;
  events: { id: string; title: string }[];
  linkedEventIds: string[];
  places: GuidePlace[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const dragId = useRef<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [interestQuery, setInterestQuery] = useState("");
  const [listingQuery, setListingQuery] = useState("");
  const [listingResults, setListingResults] = useState<GuideListingPreview[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickerFor, setPickerFor] = useState<"new" | string | null>(null);
  const [pickerInterestIds, setPickerInterestIds] = useState<string[]>(guide.interest_ids);
  const [pickerInterestQuery, setPickerInterestQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [titlesOpen, setTitlesOpen] = useState(true);
  const savedPrice = parseUnderPriceTitle(guide.title === "Untitled Guide" ? "" : guide.title);
  const savedPlace = places.find((place) => place.name === savedPrice?.placeName) ?? null;
  const [priceOn, setPriceOn] = useState(Boolean(savedPrice));
  const [priceAmount, setPriceAmount] = useState(savedPrice?.amount ?? 200);
  const [amountText, setAmountText] = useState(String(savedPrice?.amount ?? 200));
  const [placeId, setPlaceId] = useState(savedPlace?.id ?? "");
  const [fillKey, setFillKey] = useState(0);
  const [filling, setFilling] = useState(false);
  const [matchNote, setMatchNote] = useState("");
  const fillSkip = useRef(true);
  const placesRef = useRef(places);
  placesRef.current = places;
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<GuideStepKey>("list");
  const [openSteps, setOpenSteps] = useState<Record<GuideStepKey, boolean>>({
    list: true,
    audience: guide.interest_ids.length > 0,
    window: Boolean(guide.publish_at || guide.expire_at),
    spots: true,
    events: linkedEventIds.length > 0,
  });
  const [draft, setDraft] = useState<GuideDraft>(() => ({
    title: guide.title === "Untitled Guide" ? "" : guide.title,
    intro: guide.intro ?? "",
    publish_at: toZaLocalInput(guide.publish_at),
    expire_at: toZaLocalInput(guide.expire_at),
    interest_ids: guide.interest_ids,
    items: guide.items,
  }));

  const selectedInterests = useMemo(
    () => catalog.interests.filter((item) => draft.interest_ids.includes(item.id)),
    [catalog.interests, draft.interest_ids],
  );

  const interestResults = useMemo(() => {
    const q = interestQuery.trim().toLowerCase();
    if (!q) return [];
    return catalog.interests
      .filter((item) => item.title.toLowerCase().includes(q))
      .slice(0, 12);
  }, [catalog.interests, interestQuery]);

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

  function stepOpen(key: GuideStepKey) {
    return openSteps[key];
  }

  function jump(key: GuideStepKey) {
    setActiveStep(key);
    setOpenSteps((current) => ({ ...current, [key]: true }));
    document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleStep(key: GuideStepKey) {
    setActiveStep(key);
    setOpenSteps((current) => ({ ...current, [key]: !current[key] }));
  }

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
    if (fillSkip.current) {
      fillSkip.current = false;
      return;
    }
    if (!priceOn) return;
    const place = placesRef.current.find((item) => item.id === placeId) ?? null;
    const amount = Math.round(priceAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setFilling(true);
      try {
        const params = new URLSearchParams({ maxPrice: String(amount) });
        if (place) {
          params.set("lat", String(place.lat));
          params.set("lng", String(place.lng));
        }
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
        setDraft((current) => {
          const notes = new Map(current.items.map((item) => [item.listing_id, item.editorial_note]));
          return {
            ...current,
            title: underPriceTitle(amount, place?.name ?? null),
            items: listings.map((listing) => ({
              listing_id: listing.id,
              editorial_note: notes.get(listing.id) ?? "",
              listing,
            })),
          };
        });
        setMatchNote(pricedGuideSummary(listings.length, total, amount, place?.name ?? null));
        setOpenSteps((current) => ({ ...current, spots: true }));
        setActiveStep("spots");
        setSaveNotice(null);
        document.getElementById("step-spots")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  }, [fillKey, placeId, priceAmount, priceOn]);

  function patch(partial: Partial<GuideDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setSaveNotice(null);
  }

  function toggleInterest(id: string) {
    patch({
      interest_ids: draft.interest_ids.includes(id)
        ? draft.interest_ids.filter((item) => item !== id)
        : [...draft.interest_ids, id],
    });
  }

  function togglePickerInterest(id: string) {
    setPickerInterestIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 12),
    );
  }

  function addListing(listing: GuideListingPreview) {
    if (draft.items.some((item) => item.listing_id === listing.id)) return;
    if (pickerFor && pickerFor !== "new") {
      patch({
        items: draft.items.map((item) =>
          item.listing_id === pickerFor
            ? { listing_id: listing.id, editorial_note: item.editorial_note, listing }
            : item,
        ),
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
        intro: draft.intro,
        publish_at: draft.publish_at,
        expire_at: draft.expire_at,
        interest_ids: draft.interest_ids,
        items: draft.items.map((item) => ({
          listing_id: item.listing_id,
          editorial_note: item.editorial_note,
        })),
      });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setSaveNotice("Guide saved.");
      router.refresh();
    });
  }

  const isNew = guide.title === "Untitled Guide" && guide.items.length === 0;
  const heading = draft.title.trim() || "Untitled Guide";
  const audienceSummary =
    selectedInterests.map((interest) => interest.title).join(", ") || "None yet";

  return (
    <div className="cr-editor-page">
      <aside className="cr-edit-nav" aria-label="Edit guide">
        <a className="cr-edit-spine" href="/admin/guides">
          <span className="cr-edit-spine-mark" aria-hidden="true" />
          <span>Guides</span>
        </a>
        <div className="cr-edit-nav-body">
          <a className="cr-edit-brand" href="/admin/guides" aria-label="Guides">
            <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="Venturo" />
          </a>
          <p className="cr-edit-title">Guides</p>
          <p className="cr-edit-current">{isNew ? "New Guide" : "Edit Guide"}</p>
          <p className="cr-edit-group">Content</p>
          <p className="cr-edit-section">Guides</p>
          <nav className="cr-edit-steps">
            {GUIDE_STEPS.map((step) => (
              <button
                key={step.key}
                type="button"
                className={activeStep === step.key ? "active" : undefined}
                aria-current={activeStep === step.key ? "true" : undefined}
                onClick={() => jump(step.key)}
              >
                {step.label}
              </button>
            ))}
          </nav>
          <div className="cr-edit-actions">
            <button className="btn cr-save" type="button" onClick={onSave} disabled={pending}>
              {pending ? "Saving…" : "Save Guide"}
            </button>
            <GuideActions
              guideId={guide.id}
              status={guide.status}
              onExportInstagram={() => setExportOpen(true)}
            />
          </div>
          <div className={guide.status === "published" ? "cr-edit-status is-live" : "cr-edit-status"}>
            <p>Guide Status</p>
            <p>{guideStatusLabel(guide.status)}</p>
          </div>
        </div>
      </aside>

      <div className="cr-editor-stage">
      <header className="cr-editor-head">
        <div>
          <p className="cr-editor-kicker">Guides</p>
          <h1>{heading}</h1>
        </div>
      </header>

      {(error || saveError) && <p className="error">{error || saveError}</p>}
      {(notice || saveNotice) && <p className="notice">{notice || saveNotice}</p>}

      <GuideExportModal
        open={exportOpen}
        title={draft.title}
        intro={draft.intro}
        items={draft.items}
        onClose={() => setExportOpen(false)}
      />

      <div className="cr-editor is-single">
      <div className="cr-paper cr-guide-editor">
        <section className={stepOpen("list") ? "cr-step is-open" : "cr-step"} id="step-list">
          <h2>
            <button
              type="button"
              className="cr-step-toggle"
              aria-expanded={stepOpen("list")}
              onClick={() => toggleStep("list")}
            >
              <em>The List</em>
              {!stepOpen("list") ? <small className="cr-guide-step-summary">{heading}</small> : null}
              <i className="cr-step-caret" aria-hidden="true" />
            </button>
          </h2>
          <label className="field">
            <span>Guide Title</span>
            <input
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Top Things to Do This Weekend"
            />
          </label>
          <button
            className="cr-text-remove"
            type="button"
            onClick={() => setTitlesOpen((current) => !current)}
          >
            {titlesOpen ? "Hide suggested titles" : "Use a suggested title"}
          </button>
          {titlesOpen ? (
            <div className="cr-chip-grid" style={{ marginTop: 12 }}>
              {SUGGESTED_GUIDE_TITLES.map((title) => (
                <button
                  key={title}
                  type="button"
                  className={
                    (title === UNDER_PRICE_TITLE ? priceOn : !priceOn && draft.title === title)
                      ? "cr-tag active"
                      : "cr-tag"
                  }
                  onClick={() => {
                    if (title === UNDER_PRICE_TITLE) {
                      setPriceOn(true);
                      setPriceAmount(200);
                      setAmountText("200");
                      setPlaceId("");
                      setFillKey((current) => current + 1);
                      return;
                    }
                    setPriceOn(false);
                    setMatchNote("");
                    patch({ title });
                  }}
                >
                  {title}
                </button>
              ))}
            </div>
          ) : null}
          {priceOn ? (
            <>
              <p className="muted cr-step-help">
                Change the amount or the place and the matching businesses replace Recommendations.
                Notes on listings that stay are kept.
              </p>
              <div className="field-row">
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
                <label className="field">
                  <span>In and around</span>
                  <select
                    value={placeId}
                    aria-label="Place"
                    onChange={(event) => {
                      const amount = Math.round(Number(amountText));
                      if (Number.isFinite(amount) && amount > 0) {
                        setAmountText(String(amount));
                        setPriceAmount(amount);
                      }
                      setPlaceId(event.target.value);
                    }}
                  >
                    <option value="">Anywhere</option>
                    {places.map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="muted">{filling ? "Finding listings…" : matchNote}</p>
            </>
          ) : null}
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

        <section className={stepOpen("audience") ? "cr-step is-open" : "cr-step"} id="step-audience">
          <h2>
            <button
              type="button"
              className="cr-step-toggle"
              aria-expanded={stepOpen("audience")}
              onClick={() => toggleStep("audience")}
            >
              <em>Audience</em>
              {!stepOpen("audience") ? (
                <small className="cr-guide-step-summary">{audienceSummary}</small>
              ) : null}
              <i className="cr-step-caret" aria-hidden="true" />
            </button>
          </h2>
          <p className="muted cr-step-help">
            Interests help us target this list later. They do not change who sees it yet.
          </p>
          {selectedInterests.length > 0 && (
            <div className="cr-chip-grid" style={{ marginBottom: 12 }}>
              {selectedInterests.map((interest) => (
                <button
                  key={interest.id}
                  type="button"
                  className="cr-tag active"
                  onClick={() => toggleInterest(interest.id)}
                >
                  {interest.title} ×
                </button>
              ))}
            </div>
          )}
          <label className="field">
            <span>Search Interests</span>
            <input
              value={interestQuery}
              onChange={(e) => setInterestQuery(e.target.value)}
              placeholder="Kids, Adventure, Couples…"
            />
          </label>
          {interestQuery.trim() && interestResults.length === 0 ? (
            <p className="muted">No matching interests.</p>
          ) : null}
          <div className="cr-chip-grid">
            {interestResults.map((interest) => (
              <button
                key={interest.id}
                type="button"
                className={draft.interest_ids.includes(interest.id) ? "cr-tag active" : "cr-tag"}
                onClick={() => toggleInterest(interest.id)}
              >
                {interest.title}
              </button>
            ))}
          </div>
        </section>

        <section className={stepOpen("window") ? "cr-step is-open" : "cr-step"} id="step-window">
          <h2>
            <button
              type="button"
              className="cr-step-toggle"
              aria-expanded={stepOpen("window")}
              onClick={() => toggleStep("window")}
            >
              <em>Window</em>
              {!stepOpen("window") ? (
                <small className="cr-guide-step-summary">
                  {windowSummary(draft.publish_at, draft.expire_at)}
                </small>
              ) : null}
              <i className="cr-step-caret" aria-hidden="true" />
            </button>
          </h2>
          <p className="muted cr-step-help">
            Times are Africa/Johannesburg. Leave both empty for an evergreen list.
          </p>
          <div className="field-row">
            <label className="field">
              <span>Publish</span>
              <input
                type="datetime-local"
                value={draft.publish_at}
                onChange={(e) => patch({ publish_at: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Expire</span>
              <input
                type="datetime-local"
                value={draft.expire_at}
                onChange={(e) => patch({ expire_at: e.target.value })}
              />
            </label>
          </div>
        </section>

        <section className={stepOpen("spots") ? "cr-step is-open" : "cr-step"} id="step-spots">
          <h2>
            <button
              type="button"
              className="cr-step-toggle"
              aria-expanded={stepOpen("spots")}
              onClick={() => toggleStep("spots")}
            >
              <em>Recommendations</em>
              {!stepOpen("spots") ? (
                <small className="cr-guide-step-summary">
                  {draft.items.length === 0
                    ? "None yet"
                    : draft.items.length === 1
                      ? "1 listing"
                      : `${draft.items.length} listings`}
                </small>
              ) : null}
              <i className="cr-step-caret" aria-hidden="true" />
            </button>
          </h2>
          <p className="muted cr-step-help">
            Drag the handle to reorder. Name, place, price & hours come from the listing.
          </p>
          <div className="cr-guide-items">
            {draft.items.length === 0 && (
              <p className="muted">No recommendations yet. Add a live listing below.</p>
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
                  {notesOpen[item.listing_id] || item.editorial_note.trim() ? (
                    <label className="field">
                      <span>Editorial Note (optional)</span>
                      <textarea
                        rows={2}
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
                        placeholder="Worth it for the sunset views."
                      />
                    </label>
                  ) : (
                    <button
                      className="cr-text-remove"
                      type="button"
                      onClick={() =>
                        setNotesOpen((current) => ({ ...current, [item.listing_id]: true }))
                      }
                    >
                      Add a note
                    </button>
                  )}
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
            <button
              className="cr-outline-btn"
              type="button"
              onClick={() => {
                setFilterOpen(false);
                setSearching(true);
                setPickerFor(pickerFor === "new" ? null : "new");
                setListingQuery("");
              }}
            >
              {pickerFor === "new" ? "Close search" : "Add recommendation"}
            </button>
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

        <form
          action={saveGuideEvents}
          className={stepOpen("events") ? "cr-step is-open" : "cr-step"}
          id="step-events"
        >
          <h2>
            <button
              type="button"
              className="cr-step-toggle"
              aria-expanded={stepOpen("events")}
              onClick={() => toggleStep("events")}
            >
              <em>Linked Events</em>
              {!stepOpen("events") ? (
                <small className="cr-guide-step-summary">
                  {linkedEventIds.length === 0
                    ? "None yet"
                    : linkedEventIds.length === 1
                      ? "1 event"
                      : `${linkedEventIds.length} events`}
                </small>
              ) : null}
              <i className="cr-step-caret" aria-hidden="true" />
            </button>
          </h2>
          <p className="muted cr-step-help">
            Activities stay in the list above. Tick the events this guide should open in the app.
          </p>
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
            <button className="cr-outline-btn" type="submit">
              Save Event Links
            </button>
          ) : null}
        </form>
      </div>
      </div>
      </div>
    </div>
  );
}
