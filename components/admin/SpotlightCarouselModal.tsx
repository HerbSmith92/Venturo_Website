"use client";

import { useMemo, useState } from "react";
import type { GuideAuthor } from "@/lib/guide-authors";
import {
  coverPhoto,
  htmlToPlainText,
  instagramPhotos,
  spotlightPriceLabel,
  type SpotlightCover,
  type SpotlightPhoto,
  type SpotlightSection,
  type SpotlightVisitInfo,
} from "@/lib/spotlight";

type Slide =
  | { id: string; kind: "cover"; title: string; subtitle: string; image: string }
  | { id: string; kind: "story"; heading: string; body: string }
  | { id: string; kind: "photo"; image: string; caption: string }
  | { id: string; kind: "photo-text"; heading: string; body: string; image: string }
  | { id: string; kind: "visit"; name: string; area: string; price: string; pack: string }
  | { id: string; kind: "author"; name: string; handle: string; bio: string; photo: string };

function buildSlides(input: {
  title: string;
  intro: string;
  story: SpotlightSection[];
  photos: SpotlightPhoto[];
  cover: SpotlightCover;
  listing: SpotlightVisitInfo | null;
  author: GuideAuthor | null;
}): Slide[] {
  const hero = coverPhoto(input.photos, input.cover);
  const ig = instagramPhotos(input.photos);
  const images = (ig.length ? ig : input.photos).map((photo) => photo.url);
  const copySections = input.story.filter((section) => section.type === "story" || section.type === "tip");
  const quote = input.story.find((section) => section.type === "quote");
  const handle = (input.author?.instagram_url ?? "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
  const slides: Slide[] = [
    {
      id: "cover",
      kind: "cover",
      title: input.title || "A little chalk. A lot of courage.",
      subtitle: input.listing ? `${input.listing.name} · ${input.listing.area}` : input.intro,
      image: hero?.url ?? images[0] ?? "",
    },
  ];
  const firstCopy = copySections[0];
  if (firstCopy) {
    slides.push({
      id: "story-1",
      kind: "story",
      heading: firstCopy.heading || "Start with one move.",
      body: htmlToPlainText(firstCopy.bodyHtml) || firstCopy.text || input.intro,
    });
  }
  if (images[1] || images[0]) {
    slides.push({
      id: "photo-1",
      kind: "photo",
      image: images[1] ?? images[0] ?? "",
      caption: quote?.text || "Find your grip.",
    });
  }
  if (copySections[1]) {
    slides.push({
      id: "photo-text",
      kind: "photo-text",
      heading: copySections[1].heading || "Bring your cheer squad.",
      body: htmlToPlainText(copySections[1].bodyHtml) || copySections[1].text,
      image: images[2] ?? images[0] ?? "",
    });
  }
  if (input.listing) {
    const price = spotlightPriceLabel(input.listing.fromPrice);
    slides.push({
      id: "visit",
      kind: "visit",
      name: input.listing.name,
      area: input.listing.area,
      price: price || "Check prices, hours & bookings",
      pack: "Comfortable clothes",
    });
  }
  if (input.author) {
    slides.push({
      id: "author",
      kind: "author",
      name: input.author.display_name,
      handle: handle ? `@${handle.replace(/^@/, "")}` : "",
      bio: input.author.tagline || input.author.bio || "",
      photo: input.author.photo_url ?? "",
    });
  }
  return slides;
}

function SlideCard({ slide, index, total }: { slide: Slide; index: number; total: number }) {
  const count = `${String(index + 1).padStart(2, "0")}/${String(total).padStart(2, "0")}`;
  if (slide.kind === "cover") {
    return (
      <div className="spotlight-ig-slide is-photo" style={{ backgroundImage: `url(${slide.image})` }}>
        <p className="spotlight-ig-brand">Venturo</p>
        <div>
          <p className="spotlight-kicker">Activity Spotlight</p>
          <h3>{slide.title}</h3>
          <p>{slide.subtitle}</p>
        </div>
        <span>{count}</span>
      </div>
    );
  }
  if (slide.kind === "story") {
    return (
      <div className="spotlight-ig-slide is-light">
        <p className="spotlight-ig-brand is-dark">Venturo</p>
        <div>
          <p className="spotlight-kicker">The first climb</p>
          <h3>{slide.heading}</h3>
          <p>{slide.body}</p>
        </div>
        <span>{count}</span>
      </div>
    );
  }
  if (slide.kind === "photo") {
    return (
      <div className="spotlight-ig-slide is-photo" style={{ backgroundImage: `url(${slide.image})` }}>
        <p className="spotlight-ig-brand">Venturo</p>
        <p className="spotlight-ig-chip">{slide.caption}</p>
        <span>{count}</span>
      </div>
    );
  }
  if (slide.kind === "photo-text") {
    return (
      <div className="spotlight-ig-slide is-dark">
        <p className="spotlight-ig-brand">Venturo</p>
        <div>
          <h3>{slide.heading}</h3>
          <p>{slide.body}</p>
        </div>
        {slide.image ? <img src={slide.image} alt="" /> : null}
        <span>{count}</span>
      </div>
    );
  }
  if (slide.kind === "visit") {
    return (
      <div className="spotlight-ig-slide is-light">
        <p className="spotlight-ig-brand is-dark">Venturo</p>
        <div>
          <p className="spotlight-kicker">Before you go</p>
          <h3>{slide.name}</h3>
          <p>{slide.area}</p>
          <p>{slide.price}</p>
          <p>Pack · {slide.pack}</p>
        </div>
        <span>{count}</span>
      </div>
    );
  }
  return (
    <div className="spotlight-ig-slide is-dark">
      <p className="spotlight-ig-brand">Venturo</p>
      {slide.photo ? <img className="spotlight-ig-avatar" src={slide.photo} alt="" /> : null}
      <div>
        <p className="spotlight-kicker">Meet your guide</p>
        <h3>{slide.name}</h3>
        {slide.handle ? <p>{slide.handle}</p> : null}
        {slide.bio ? <p>{slide.bio}</p> : null}
      </div>
      <span>{count}</span>
    </div>
  );
}

export function SpotlightCarouselModal({
  open,
  onClose,
  title,
  intro,
  story,
  photos,
  cover,
  listing,
  author,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: string;
  story: SpotlightSection[];
  photos: SpotlightPhoto[];
  cover: SpotlightCover;
  listing: SpotlightVisitInfo | null;
  author: GuideAuthor | null;
}) {
  const seed = useMemo(
    () => buildSlides({ title, intro, story, photos, cover, listing, author }),
    [title, intro, story, photos, cover, listing, author],
  );
  const [slides, setSlides] = useState(seed);
  const [index, setIndex] = useState(0);

  if (!open) return null;
  const slide = slides[index] ?? slides[0];

  function patch(partial: Partial<Slide>) {
    setSlides((current) => current.map((item, i) => (i === index ? ({ ...item, ...partial } as Slide) : item)));
  }

  return (
    <div className="cr-ig-modal" role="dialog" aria-modal="true" aria-label="Generate carousel">
      <button type="button" className="cr-ig-backdrop" aria-label="Close carousel editor" onClick={onClose} />
      <div className="cr-ig-panel">
        <header className="cr-ig-panel-head">
          <div>
            <p className="eyebrow">Instagram carousel</p>
            <h2>Generate carousel</h2>
            <p className="muted">Shorten copy, reorder slides &amp; crop for portrait. This does not change the website guide.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="spotlight-ig-editor">
          <div className="spotlight-ig-preview">{slide ? <SlideCard slide={slide} index={index} total={slides.length} /> : null}</div>
          <div className="spotlight-ig-tools">
            <label>
              Slide
              <select value={String(index)} onChange={(event) => setIndex(Number(event.target.value))}>
                {slides.map((item, i) => (
                  <option key={item.id} value={i}>
                    {String(i + 1).padStart(2, "0")} · {item.kind}
                  </option>
                ))}
              </select>
            </label>
            {slide && "title" in slide ? (
              <label>
                Title
                <textarea value={slide.title} onChange={(event) => patch({ title: event.target.value })} />
              </label>
            ) : null}
            {slide && "heading" in slide ? (
              <label>
                Heading
                <input value={slide.heading} onChange={(event) => patch({ heading: event.target.value })} />
              </label>
            ) : null}
            {slide && "body" in slide ? (
              <label>
                Copy
                <textarea value={slide.body} onChange={(event) => patch({ body: event.target.value })} />
              </label>
            ) : null}
            {slide && "caption" in slide ? (
              <label>
                Caption
                <input value={slide.caption} onChange={(event) => patch({ caption: event.target.value })} />
              </label>
            ) : null}
            {slide && "bio" in slide ? (
              <label>
                Bio
                <textarea value={slide.bio} onChange={(event) => patch({ bio: event.target.value })} />
              </label>
            ) : null}
            <div className="cr-actions">
              <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={index >= slides.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
