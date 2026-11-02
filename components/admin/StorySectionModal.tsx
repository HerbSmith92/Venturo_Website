"use client";

import { useEffect, useMemo, useState } from "react";
import { StoryPhotoPicker } from "@/components/admin/StoryPhotoPicker";
import { StoryRichText } from "@/components/admin/StoryRichText";
import { SpotlightSectionView } from "@/components/spotlight/SpotlightSectionView";
import {
  cloneSection,
  emptyPlacement,
  emptySection,
  layoutSlotCount,
  photoById,
  photoLayoutLabel,
  sectionValidation,
  type PhotoLayout,
  type SpotlightCover,
  type SpotlightPhoto,
  type SpotlightPlacement,
  type SpotlightSection,
  type StorySectionType,
} from "@/lib/spotlight";

const STORY_LAYOUTS: PhotoLayout[] = ["none", "one", "two", "gallery"];
const PHOTO_ONLY_LAYOUTS: PhotoLayout[] = ["one", "two", "gallery"];

export function StorySectionModal({
  open,
  mode,
  sectionType,
  initial,
  photos,
  sections,
  cover,
  guideId,
  authorName,
  saveState,
  saveError,
  onPhotosChange,
  onClose,
  onDiscard,
  onSave,
  onInsertPhotoBreak,
}: {
  open: boolean;
  mode: "add" | "edit";
  sectionType: StorySectionType;
  initial: SpotlightSection | null;
  photos: SpotlightPhoto[];
  sections: SpotlightSection[];
  cover: SpotlightCover;
  guideId: string;
  authorName?: string | null;
  saveState: "idle" | "saving" | "saved" | "failed";
  saveError: string | null;
  onPhotosChange: (photos: SpotlightPhoto[]) => void;
  onClose: () => void;
  onDiscard: () => void;
  onSave: (section: SpotlightSection) => void;
  onInsertPhotoBreak?: (writing: SpotlightSection, afterHtml: string) => void;
}) {
  const [draft, setDraft] = useState(() => initial ?? emptySection(sectionType));
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pickerFor, setPickerFor] = useState<"gallery" | number | null>(null);
  const [keepLayout, setKeepLayout] = useState<PhotoLayout | null>(null);
  const [keepIds, setKeepIds] = useState<string[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [errors, setErrors] = useState<{ field: "body" | "photos" | "layout"; message: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ? cloneSection(initial) : emptySection(sectionType));
    setPane("edit");
    setDevice("desktop");
    setPickerFor(null);
    setKeepLayout(null);
    setLeaveOpen(false);
    setErrors([]);
  }, [open, initial?.id, sectionType, mode]);

  const snapshot = useMemo(() => JSON.stringify(initial ?? emptySection(sectionType)), [initial, sectionType]);
  const dirty = JSON.stringify(draft) !== snapshot;
  const layouts = draft.type === "photos" ? PHOTO_ONLY_LAYOUTS : draft.type === "story" ? STORY_LAYOUTS : [];

  if (!open) return null;

  function patch(partial: Partial<SpotlightSection>) {
    setDraft((current) => ({ ...current, ...partial }));
    setErrors([]);
  }

  function applyLayout(layout: PhotoLayout, placements = draft.placements) {
    const slots = layoutSlotCount(layout);
    let next = placements.filter((placement) => placement.photoId);
    if (slots === 0) next = [];
    else if (slots != null) {
      next = next.slice(0, slots);
      while (next.length < slots) next.push(emptyPlacement());
    }
    patch({ layout, placements: next });
    setKeepLayout(null);
  }

  function requestLayout(layout: PhotoLayout) {
    if (layout === draft.layout) return;
    const filled = draft.placements.filter((placement) => placement.photoId);
    const slots = layoutSlotCount(layout);
    if (slots != null && filled.length > slots) {
      setKeepLayout(layout);
      setKeepIds(filled.slice(0, slots).map((placement) => placement.id));
      return;
    }
    applyLayout(layout);
  }

  function patchPlacement(id: string, partial: Partial<SpotlightPlacement>) {
    patch({
      placements: draft.placements.map((placement) => (placement.id === id ? { ...placement, ...partial } : placement)),
    });
  }

  function choosePhotos(chosen: SpotlightPhoto[]) {
    if (pickerFor === "gallery") {
      const extra = chosen.map((photo) => {
        const placement = emptyPlacement(photo.id);
        placement.alt = photo.alt;
        return placement;
      });
      patch({ placements: [...draft.placements.filter((placement) => placement.photoId), ...extra] });
    } else if (typeof pickerFor === "number") {
      const photo = chosen[0];
      if (!photo) return;
      const next = [...draft.placements];
      const current = next[pickerFor] ?? emptyPlacement();
      next[pickerFor] = { ...current, photoId: photo.id, alt: current.alt || photo.alt };
      patch({ placements: next });
    }
    setPickerFor(null);
  }

  function swapPair() {
    if (draft.placements.length < 2) return;
    const next = [...draft.placements];
    [next[0], next[1]] = [next[1], next[0]];
    patch({ placements: next });
  }

  function removePlacement(id: string) {
    if (draft.layout === "gallery") {
      patch({ placements: draft.placements.filter((placement) => placement.id !== id) });
      return;
    }
    patch({
      placements: draft.placements.map((placement) => (placement.id === id ? { ...placement, photoId: "" } : placement)),
    });
  }

  function moveGallery(from: number, to: number) {
    if (to < 0 || to >= draft.placements.length) return;
    const next = [...draft.placements];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    patch({ placements: next });
  }

  function attemptClose() {
    if (dirty) {
      setLeaveOpen(true);
      return;
    }
    onClose();
  }

  function save() {
    const nextErrors = sectionValidation(draft);
    setErrors(nextErrors);
    if (nextErrors.length) return;
    onSave(draft);
  }

  const bodyError = errors.find((item) => item.field === "body")?.message;
  const photoError = errors.find((item) => item.field === "photos")?.message;

  return (
    <div className="story-modal" role="dialog" aria-modal="true" aria-labelledby="story-modal-title">
      <div className="story-modal-shell">
        <header className="story-modal-head">
          <div>
            <p className="eyebrow">Story builder</p>
            <h2 id="story-modal-title">{mode === "add" ? "Add story section" : "Edit story section"}</h2>
            <p>Write your story, choose photos &amp; preview the layout.</p>
          </div>
          <button type="button" aria-label="Close" onClick={attemptClose}>
            ×
          </button>
        </header>
        <div className="story-modal-tabs">
          <button type="button" className={pane === "edit" ? "is-on" : undefined} onClick={() => setPane("edit")}>
            Edit
          </button>
          <button type="button" className={pane === "preview" ? "is-on" : undefined} onClick={() => setPane("preview")}>
            Preview
          </button>
        </div>
        <div className={`story-modal-grid${pane === "preview" ? " is-preview" : " is-edit"}`}>
          <div className="story-modal-edit">
            {draft.type === "story" ? (
              <div className="story-text-pane">
                <label className="field">
                  <span>Section heading (optional)</span>
                  <input value={draft.heading} onChange={(event) => patch({ heading: event.target.value })} placeholder="Make something together" />
                </label>
                <div className="field story-text-field">
                  <span>Story text</span>
                  <StoryRichText
                    value={draft.bodyHtml}
                    onChange={(bodyHtml) => patch({ bodyHtml })}
                    placeholder="Choose a painting theme together & keep your canvases hidden until the big reveal."
                    onInsertPhotos={(split) => {
                      const writing: SpotlightSection = {
                        ...draft,
                        bodyHtml: split.before,
                        layout: "none",
                        placements: [],
                      };
                      setDraft(writing);
                      onInsertPhotoBreak?.(writing, split.after);
                    }}
                  />
                  {bodyError ? <p className="story-modal-error">{bodyError}</p> : null}
                </div>
              </div>
            ) : null}
            {draft.type === "quote" ? (
              <>
                <label className="field">
                  <span>Quote</span>
                  <textarea value={draft.text} onChange={(event) => patch({ text: event.target.value })} rows={5} />
                  {bodyError ? <p className="story-modal-error">{bodyError}</p> : null}
                </label>
                <label className="field">
                  <span>Attribution (optional)</span>
                  <input value={draft.attribution} onChange={(event) => patch({ attribution: event.target.value })} placeholder="Local painter, Johannesburg" />
                </label>
              </>
            ) : null}
            {draft.type === "tip" ? (
              <label className="field">
                <span>Author’s tip</span>
                <textarea value={draft.text} onChange={(event) => patch({ text: event.target.value })} rows={5} />
                {bodyError ? <p className="story-modal-error">{bodyError}</p> : null}
              </label>
            ) : null}

            <div className="story-media-pane">
            {layouts.length > 0 ? (
              <div className="field">
                <span>{draft.type === "photos" ? "Photo layout" : "Photos for this section"}</span>
                <p className="story-layout-help">
                  {draft.layout === "none"
                    ? "Selected: text only, no photos."
                    : draft.layout === "one"
                      ? "Selected: one photo below the writing."
                      : draft.layout === "two"
                        ? "Selected: two photos side by side, stacked on a phone."
                        : "Selected: a photo grid below the writing."}
                </p>
                <div className="story-layout-tiles" role="radiogroup" aria-label="Photo layout">
                  {layouts.map((layout) => (
                    <button
                      key={layout}
                      type="button"
                      role="radio"
                      aria-checked={draft.layout === layout}
                      className={draft.layout === layout ? "is-on" : undefined}
                      onClick={() => requestLayout(layout)}
                    >
                      <LayoutGlyph layout={layout} />
                      {draft.layout === layout ? <i aria-hidden="true">✓</i> : null}
                      <span>{photoLayoutLabel(layout)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.layout !== "none" ? (
              <div className="story-photo-slots">
                {photoError ? <p className="story-modal-error">{photoError}</p> : null}
                {draft.layout === "two" ? (
                  <div className="story-pair-tools">
                    <button type="button" className="btn btn-secondary" onClick={swapPair}>
                      Swap photos
                    </button>
                  </div>
                ) : null}
                {draft.placements.map((placement, index) => (
                  <PhotoSlot
                    key={placement.id}
                    label={draft.layout === "two" ? (index === 0 ? "Left photo" : "Right photo") : `Photo ${index + 1}`}
                    placement={placement}
                    photo={photoById(photos, placement.photoId)}
                    onReplace={() => setPickerFor(index)}
                    onRemove={() => removePlacement(placement.id)}
                    onChange={(partial) => patchPlacement(placement.id, partial)}
                    onMove={draft.layout === "gallery" ? (direction) => moveGallery(index, index + direction) : undefined}
                    index={index}
                    total={draft.placements.length}
                  />
                ))}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (draft.layout === "gallery") {
                      setPickerFor("gallery");
                      return;
                    }
                    const empty = draft.placements.findIndex((item) => !item.photoId);
                    setPickerFor(empty >= 0 ? empty : 0);
                  }}
                >
                  + Choose photos
                </button>
                <p className="muted">Activity photos · Guide uploads · Upload new</p>
              </div>
            ) : null}
            </div>
          </div>
          <aside className="story-modal-preview">
            <div className="story-preview-bar">
              <strong>Live preview</strong>
              <div>
                <button type="button" className={device === "desktop" ? "is-on" : undefined} onClick={() => setDevice("desktop")}>
                  Desktop
                </button>
                <button type="button" className={device === "mobile" ? "is-on" : undefined} onClick={() => setDevice("mobile")}>
                  Mobile
                </button>
              </div>
            </div>
            <div className={`story-preview spotlight-page${device === "mobile" ? " is-mobile" : ""}`}>
              <div className="spotlight-story">
                <SpotlightSectionView section={draft} photos={photos} authorName={authorName} />
              </div>
            </div>
            {device === "mobile" && (draft.layout === "two" || draft.layout === "gallery") ? (
              <p className="muted">Mobile preview · Photos stack on mobile</p>
            ) : null}
          </aside>
        </div>
        <footer className="story-modal-foot">
          <p className="muted">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved to draft"
                : saveState === "failed"
                  ? saveError ?? "Could not save that section."
                  : mode === "add"
                    ? "Changes apply to this section only."
                    : "Saving updates the draft. It does not publish the guide."}
          </p>
          <div>
            <button type="button" className="btn btn-secondary" onClick={attemptClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saveState === "saving"}>
              {mode === "add" ? "Add to story" : "Save section"}
            </button>
          </div>
        </footer>
      </div>

      {keepLayout ? (
        <div className="story-confirm">
          <div>
            <h3>Which photos should stay?</h3>
            <p>This layout keeps {layoutSlotCount(keepLayout)} photo{layoutSlotCount(keepLayout) === 1 ? "" : "s"}. Writing stays as it is.</p>
            {draft.placements.filter((placement) => placement.photoId).map((placement) => {
              const photo = photoById(photos, placement.photoId);
              const on = keepIds.includes(placement.id);
              return (
                <label key={placement.id} className="story-keep">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setKeepIds((current) => (on ? current.filter((id) => id !== placement.id) : [...current, placement.id]))
                    }
                  />
                  {photo ? <img src={photo.url} alt="" /> : null}
                  <span>{placement.caption || "Photo"}</span>
                </label>
              );
            })}
            <footer>
              <button type="button" className="btn btn-secondary" onClick={() => setKeepLayout(null)}>
                Keep current layout
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => applyLayout(keepLayout, draft.placements.filter((placement) => keepIds.includes(placement.id)))}
                disabled={keepIds.length !== (layoutSlotCount(keepLayout) ?? 0)}
              >
                Apply layout
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {leaveOpen ? (
        <div className="story-confirm">
          <div>
            <h3>Discard changes?</h3>
            <p>This section has unsaved edits.</p>
            <footer>
              <button type="button" className="btn btn-secondary" onClick={() => setLeaveOpen(false)}>
                Keep editing
              </button>
              <button type="button" className="btn btn-primary" onClick={onDiscard}>
                Discard changes
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <StoryPhotoPicker
        open={pickerFor != null}
        photos={photos}
        sections={sections}
        cover={cover}
        guideId={guideId}
        multiple={pickerFor === "gallery"}
        onClose={() => setPickerFor(null)}
        onChoose={choosePhotos}
        onPhotosChange={onPhotosChange}
      />
    </div>
  );
}

function LayoutGlyph({ layout }: { layout: PhotoLayout }) {
  return (
    <span className={`story-glyph is-${layout}`} aria-hidden="true">
      {layout === "none" ? <b /> : null}
      {layout === "gallery" ? (
        <>
          <i />
          <i />
          <i />
          <i />
        </>
      ) : layout === "two" ? (
        <>
          <i />
          <i />
        </>
      ) : (
        <i />
      )}
    </span>
  );
}

function PhotoSlot({
  label,
  placement,
  photo,
  onReplace,
  onRemove,
  onChange,
  onMove,
  index,
  total,
}: {
  label: string;
  placement: SpotlightPlacement;
  photo: SpotlightPhoto | null;
  onReplace: () => void;
  onRemove: () => void;
  onChange: (partial: Partial<SpotlightPlacement>) => void;
  onMove?: (direction: -1 | 1) => void;
  index: number;
  total: number;
}) {
  return (
    <article className="story-slot">
      <header>
        <strong>{label}</strong>
        <div>
          {onMove ? (
            <>
              <button type="button" disabled={index === 0} onClick={() => onMove(-1)}>
                Up
              </button>
              <button type="button" disabled={index === total - 1} onClick={() => onMove(1)}>
                Down
              </button>
            </>
          ) : null}
          <button type="button" onClick={onRemove}>
            ×
          </button>
        </div>
      </header>
      {photo ? (
        <img src={photo.url} alt="" style={{ objectPosition: `${placement.focusX}% ${placement.focusY}%` }} />
      ) : (
        <button type="button" className="story-slot-empty" onClick={onReplace}>
          Choose photo
        </button>
      )}
      {photo ? (
        <div className="story-slot-tools">
          <button type="button" className="btn btn-secondary" onClick={onReplace}>
            Replace
          </button>
          <label>
            Crop X
            <input type="range" min={0} max={100} value={placement.focusX} onChange={(event) => onChange({ focusX: Number(event.target.value) })} />
          </label>
          <label>
            Crop Y
            <input type="range" min={0} max={100} value={placement.focusY} onChange={(event) => onChange({ focusY: Number(event.target.value) })} />
          </label>
        </div>
      ) : null}
      <label>
        Caption
        <input value={placement.caption} onChange={(event) => onChange({ caption: event.target.value })} />
      </label>
      <details>
        <summary>Photo credits &amp; accessibility</summary>
        <label>
          Credit
          <input value={placement.credit} onChange={(event) => onChange({ credit: event.target.value })} />
        </label>
        <label>
          Alt text
          <input value={placement.alt} onChange={(event) => onChange({ alt: event.target.value })} />
        </label>
      </details>
    </article>
  );
}
