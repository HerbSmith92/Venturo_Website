"use client";

import { GuideInfoBubble } from "@/components/admin/guide-desk/GuideFold";
import type { SpotlightPhoto } from "@/lib/spotlight";

export function GuidePhotoGrid({
  photos,
  coverId,
  pending,
  onPickCover,
  onRemove,
  onAdd,
}: {
  photos: SpotlightPhoto[];
  coverId: string | null;
  pending?: boolean;
  onPickCover: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className="guide-desk-card" id="field-photos">
      <h2>
        Photos
        <GuideInfoBubble label="How photos work">
          Click a photo to make it the cover. Remove extras you no longer need.
        </GuideInfoBubble>
      </h2>
      <button className="btn btn-secondary" type="button" disabled={pending} onClick={onAdd}>
        {pending ? "Uploading…" : "Add photos"}
      </button>
      {photos.length ? (
        <ul className="guide-desk-photos is-rail">
          {photos.map((photo) => (
            <li key={photo.id} className={coverId === photo.id ? "is-cover" : undefined}>
              <button type="button" onClick={() => onPickCover(photo.id)}>
                <img src={photo.url} alt="" />
                <span>
                  {coverId === photo.id ? "Cover" : photo.source === "upload" ? "Extra" : "Listing"}
                </span>
              </button>
              {photo.source === "upload" ? (
                <button className="cr-text-remove" type="button" onClick={() => onRemove(photo.id)}>
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Link an activity or add photos to choose a cover.</p>
      )}
    </section>
  );
}
