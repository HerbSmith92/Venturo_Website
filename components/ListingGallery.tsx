"use client";

import { useState } from "react";

export function ListingGallery({ photos }: { photos: { url: string; alt: string | null }[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;
  const photo = photos[index] ?? photos[0];

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
      >
        See all photos
      </button>
      {open && photo ? (
        <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Photos">
          <button type="button" className="photo-lightbox-close" onClick={() => setOpen(false)}>
            Close
          </button>
          <img src={photo.url} alt={photo.alt ?? ""} />
          <div className="photo-lightbox-nav">
            <button
              type="button"
              onClick={() => setIndex((current) => (current - 1 + photos.length) % photos.length)}
            >
              Previous
            </button>
            <span>
              {index + 1} / {photos.length}
            </span>
            <button type="button" onClick={() => setIndex((current) => (current + 1) % photos.length)}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
