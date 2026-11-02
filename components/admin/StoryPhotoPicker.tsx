"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  newSpotlightId,
  photoUsageLabels,
  type SpotlightCover,
  type SpotlightPhoto,
  type SpotlightSection,
} from "@/lib/spotlight";

const PHOTO_LIMIT = 10 * 1024 * 1024;

export function StoryPhotoPicker({
  open,
  photos,
  sections,
  cover,
  guideId,
  multiple,
  onClose,
  onChoose,
  onPhotosChange,
}: {
  open: boolean;
  photos: SpotlightPhoto[];
  sections: SpotlightSection[];
  cover: SpotlightCover;
  guideId: string;
  multiple: boolean;
  onClose: () => void;
  onChoose: (photos: SpotlightPhoto[]) => void;
  onPhotosChange: (photos: SpotlightPhoto[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"listing" | "upload">("listing");
  const [selected, setSelected] = useState<string[]>([]);
  const [inspect, setInspect] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listingPhotos = useMemo(() => photos.filter((photo) => photo.source === "listing"), [photos]);
  const uploadPhotos = useMemo(() => photos.filter((photo) => photo.source === "upload"), [photos]);
  const visible = tab === "listing" ? listingPhotos : uploadPhotos;
  const inspected = photos.find((photo) => photo.id === inspect) ?? null;

  if (!open) return null;

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return multiple ? [...current, id] : [id];
    });
  }

  async function upload(files: FileList | null) {
    const list = [...(files ?? [])];
    if (!list.length) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError("Could not reach photo storage.");
      setPending(false);
      return;
    }
    const added: SpotlightPhoto[] = [];
    for (const [index, file] of list.entries()) {
      setProgress(`Uploading ${index + 1} of ${list.length}…`);
      const allowed = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
      if (!allowed || /heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) {
        setError(`${file.name}: use a JPEG, PNG, WebP, or GIF.`);
        continue;
      }
      if (file.size > PHOTO_LIMIT) {
        setError(`${file.name}: keep it under 10 MB.`);
        continue;
      }
      const key = `${guideId}/${newSpotlightId()}-${file.name.replace(/\s+/g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("guide-spotlight").upload(key, file, {
        cacheControl: "3600",
        contentType: file.type.startsWith("image/") ? file.type : "image/jpeg",
        upsert: false,
      });
      if (uploadError) {
        setError(`${file.name}: ${uploadError.message}`);
        continue;
      }
      const { data } = supabase.storage.from("guide-spotlight").getPublicUrl(key);
      added.push({
        id: newSpotlightId(),
        source: "upload",
        listingMediaId: null,
        url: data.publicUrl,
        alt: "",
        caption: "",
        credit: "",
        cover: false,
        gallery: true,
        instagram: false,
        focusX: 50,
        focusY: 50,
      });
    }
    if (added.length) {
      const next = [...photos, ...added];
      onPhotosChange(next);
      setTab("upload");
      setSelected(multiple ? [...selected, ...added.map((photo) => photo.id)] : [added[0].id]);
    }
    setPending(false);
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function confirm() {
    const chosen = selected.map((id) => photos.find((photo) => photo.id === id)).filter((photo): photo is SpotlightPhoto => Boolean(photo));
    if (!chosen.length) {
      setError("Choose at least one photo.");
      return;
    }
    onChoose(chosen);
    setSelected([]);
  }

  return (
    <div className="story-picker" role="dialog" aria-modal="true" aria-labelledby="story-picker-title">
      <div className="story-picker-panel">
        <header>
          <div>
            <p className="eyebrow">Photos</p>
            <h3 id="story-picker-title">Choose photos</h3>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="story-picker-tabs">
          <button type="button" className={tab === "listing" ? "is-on" : undefined} onClick={() => setTab("listing")}>
            Activity photos
          </button>
          <button type="button" className={tab === "upload" ? "is-on" : undefined} onClick={() => setTab("upload")}>
            Guide uploads
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={pending}>
            Upload new
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(event) => void upload(event.target.files)}
        />
        <p className="muted">JPEG, PNG, WebP or GIF · under 10 MB each.</p>
        {progress ? <p>{progress}</p> : null}
        {error ? <p className="story-modal-error">{error}</p> : null}
        <div className="story-picker-grid">
          {visible.length === 0 ? <p className="muted">No photos in this set yet.</p> : null}
          {visible.map((photo) => {
            const on = selected.includes(photo.id);
            const uses = photoUsageLabels(photo.id, sections, cover);
            return (
              <button key={photo.id} type="button" className={on ? "is-on" : undefined} onClick={() => toggle(photo.id)}>
                <img src={photo.url} alt="" />
                {on ? <i>✓</i> : null}
                <span>{uses.length ? uses.join(" · ") : "Unused"}</span>
              </button>
            );
          })}
        </div>
        {inspected ? (
          <div className="story-picker-inspect">
            <img src={inspected.url} alt="" />
          </div>
        ) : null}
        <footer>
          <button type="button" className="btn btn-secondary" onClick={() => (inspect ? setInspect(null) : onClose())}>
            {inspect ? "Hide preview" : "Cancel"}
          </button>
          {visible[0] && !inspect ? (
            <button type="button" className="btn btn-secondary" onClick={() => setInspect(selected[0] ?? visible[0].id)}>
              Enlarge
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={pending}>
            Use selected
          </button>
        </footer>
      </div>
    </div>
  );
}
