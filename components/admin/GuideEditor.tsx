"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCuratedGuide } from "@/app/admin/guide-actions";
import { GuideActions } from "@/components/admin/GuideActions";
import { GuideExportModal } from "@/components/admin/guide-export/GuideExportModal";
import { formatRand } from "@/lib/control-room-shared";
import type { GuideEditorRecord } from "@/lib/control-room-guides";
import {
  SUGGESTED_GUIDE_TITLES,
  guideStatusLabel,
  toZaLocalInput,
  type GuideDraft,
  type GuideListingPreview,
} from "@/lib/guide-shared";
import type { EditorCatalog } from "@/lib/listing-draft";

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";

function areaLabel(listing: GuideListingPreview | null) {
  if (!listing) return "Listing missing";
  return [listing.suburb, listing.city].filter(Boolean).join(", ") || "South Africa";
}

export function GuideEditor({
  guide,
  catalog,
  notice,
  error,
}: {
  guide: GuideEditorRecord;
  catalog: EditorCatalog;
  notice?: string;
  error?: string;
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
  const [exportOpen, setExportOpen] = useState(false);
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
    return catalog.interests
      .filter((item) => !q || item.title.toLowerCase().includes(q))
      .slice(0, 16);
  }, [catalog.interests, interestQuery]);

  const pickerSelectedInterests = useMemo(
    () => catalog.interests.filter((item) => pickerInterestIds.includes(item.id)),
    [catalog.interests, pickerInterestIds],
  );

  const pickerInterestResults = useMemo(() => {
    const q = pickerInterestQuery.trim().toLowerCase();
    return catalog.interests
      .filter((item) => !q || item.title.toLowerCase().includes(q))
      .slice(0, 16);
  }, [catalog.interests, pickerInterestQuery]);

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

  return (
    <div className="cr-editor-page">
      <header className="cr-editor-head">
        <div>
          <p className="eyebrow">
            <a href="/admin/guides">Guides</a> · {guideStatusLabel(guide.status)}
          </p>
          <h1>{draft.title.trim() || "Untitled Guide"}</h1>
          <p className="lede muted">
            Pick live listings. Name, place, price & hours fill in from the directory.
          </p>
        </div>
        <a className="btn btn-secondary" href="/admin/guides">
          Back To Queue
        </a>
      </header>

      {(error || saveError) && <p className="error">{error || saveError}</p>}
      {(notice || saveNotice) && <p className="notice">{notice || saveNotice}</p>}

      <GuideActions
        guideId={guide.id}
        status={guide.status}
        onExportInstagram={() => setExportOpen(true)}
      />

      <GuideExportModal
        open={exportOpen}
        title={draft.title}
        intro={draft.intro}
        items={draft.items}
        onClose={() => setExportOpen(false)}
      />

      <div className="cr-paper cr-guide-editor">
        <section className="cr-step">
          <h2>
            <span>1</span> The List
          </h2>
          <label className="field">
            <span>Guide Title</span>
            <input
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Top Things to Do This Weekend"
            />
          </label>
          <p className="cr-field-hint">Tap a suggestion if you want a starting point.</p>
          <div className="cr-chip-grid">
            {SUGGESTED_GUIDE_TITLES.map((title) => (
              <button
                key={title}
                type="button"
                className={draft.title === title ? "cr-tag active" : "cr-tag"}
                onClick={() => patch({ title })}
              >
                {title}
              </button>
            ))}
          </div>
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

        <section className="cr-step">
          <h2>
            <span>2</span> Audience
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

        <section className="cr-step">
          <h2>
            <span>3</span> Window
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

        <section className="cr-step">
          <h2>
            <span>4</span> Recommendations
          </h2>
          <p className="muted cr-step-help">
            Move spots up or down, or drag the handle. Save Guide to keep the order. See More on
            the public page opens the listing.
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
                  <p className="muted">
                    {(item.listing?.short_description ?? "").trim() || "No short description yet."}
                  </p>
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
                  <div className="cr-actions" style={{ marginBottom: 0 }}>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveItem(item.listing_id, -1)}
                    >
                      Move Up
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={index === draft.items.length - 1}
                      onClick={() => moveItem(item.listing_id, 1)}
                    >
                      Move Down
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => {
                        setSearching(true);
                        setPickerFor(item.listing_id);
                        setListingQuery("");
                      }}
                    >
                      Replace
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => removeItem(item.listing_id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="cr-guide-picker">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setSearching(true);
                setPickerFor("new");
                setListingQuery("");
              }}
            >
              + Add Recommendation
            </button>
            {pickerFor && (
              <div className="cr-guide-search">
                <p className="muted">
                  Filter by interest, then search by name. Listings without the selected tags will
                  not appear. Clear chips to search all live listings.
                </p>
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
                <label className="field">
                  <span>Filter Interests</span>
                  <input
                    value={pickerInterestQuery}
                    onChange={(e) => setPickerInterestQuery(e.target.value)}
                    placeholder="Kids, Adventure, Couples…"
                  />
                </label>
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
                <label className="field">
                  <span>{pickerFor === "new" ? "Search Live Listings" : "Replace With"}</span>
                  <input
                    value={listingQuery}
                    onChange={(e) => setListingQuery(e.target.value)}
                    placeholder="Search by name"
                    autoFocus
                  />
                </label>
                {searching && <p className="muted">Searching…</p>}
                {!searching && pickerListings.length === 0 && (
                  <p className="muted">
                    No live listings match. Try another interest, a name search, or clear the
                    filter.
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
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setPickerFor(null)}
                >
                  Close Search
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="cr-actions">
          <button className="btn btn-primary" type="button" disabled={pending} onClick={onSave}>
            {pending ? "Saving…" : "Save Guide"}
          </button>
        </div>
      </div>
    </div>
  );
}
