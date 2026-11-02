import type { Ref } from "react";
import { exportPhotoSrc } from "@/lib/export-image";
import { GuideExportWave } from "@/components/admin/guide-export/GuideExportShell";
import type { GuideExportSlide } from "@/components/admin/guide-export/types";

function InstagramMark() {
  return (
    <svg className="cr-ig-author-ig-mark" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M7.2 3h9.6A4.2 4.2 0 0 1 21 7.2v9.6A4.2 4.2 0 0 1 16.8 21H7.2A4.2 4.2 0 0 1 3 16.8V7.2A4.2 4.2 0 0 1 7.2 3Zm9.9 2.1a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1ZM12 7.6A4.4 4.4 0 1 0 12 16.4 4.4 4.4 0 0 0 12 7.6Zm0 1.7a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Z"
      />
    </svg>
  );
}

function TopoMark() {
  return (
    <svg className="cr-ig-author-topo" viewBox="0 0 1080 820" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" stroke="#EBEBF3" strokeWidth="2">
        <ellipse cx="220" cy="180" rx="90" ry="48" />
        <ellipse cx="220" cy="180" rx="150" ry="86" />
        <ellipse cx="220" cy="180" rx="220" ry="128" />
        <ellipse cx="860" cy="120" rx="80" ry="42" />
        <ellipse cx="860" cy="120" rx="140" ry="78" />
        <ellipse cx="860" cy="120" rx="210" ry="120" />
        <ellipse cx="540" cy="430" rx="120" ry="64" />
        <ellipse cx="540" cy="430" rx="200" ry="110" />
        <ellipse cx="540" cy="430" rx="290" ry="160" />
        <ellipse cx="160" cy="620" rx="110" ry="58" />
        <ellipse cx="160" cy="620" rx="180" ry="100" />
        <ellipse cx="940" cy="640" rx="100" ry="54" />
        <ellipse cx="940" cy="640" rx="170" ry="96" />
      </g>
    </svg>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function GuideExportAuthorCard({
  slide,
  frameRef,
}: {
  slide: Extract<GuideExportSlide, { kind: "author" }>;
  frameRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="cr-ig-frame cr-ig-author" ref={frameRef}>
      <div className="cr-ig-author-sky">
        <TopoMark />
        <header className="cr-ig-author-head">
          <p className="cr-ig-author-kicker">Meet Your Guide</p>
          <img
            className="cr-ig-author-wordmark"
            src="/brand/logos/venturo-horizontal-simple-light.svg"
            alt=""
          />
        </header>

        <div className="cr-ig-author-portrait-wrap">
          <svg className="cr-ig-author-arc" viewBox="0 0 420 420" aria-hidden>
            <path
              d="M 70 70 A 175 175 0 1 1 70 350"
              fill="none"
              stroke="#F3BF4A"
              strokeWidth="10"
              strokeLinecap="round"
            />
          </svg>
          <div className="cr-ig-author-portrait">
            {slide.photo ? (
              <img src={exportPhotoSrc(slide.photo)} alt="" decoding="sync" loading="eager" />
            ) : (
              <span className="cr-ig-author-initials">{initials(slide.name)}</span>
            )}
          </div>
        </div>

        <h2 className="cr-ig-author-name">{slide.name}</h2>
        {slide.tagline ? <p className="cr-ig-author-tagline">{slide.tagline}</p> : null}
      </div>

      <div className="cr-ig-author-band">
        <GuideExportWave />
        <svg className="cr-ig-author-gold-wave" viewBox="0 0 1080 120" preserveAspectRatio="none" aria-hidden>
          <path
            d="M0 54 C210 8, 390 108, 560 62 C730 16, 900 96, 1080 48"
            fill="none"
            stroke="#F3BF4A"
            strokeWidth="14"
            strokeLinecap="round"
          />
        </svg>
        <div className="cr-ig-author-band-inner">
          <p className="cr-ig-author-curated">Curated by a local explorer</p>
          <p className="cr-ig-author-pitch">{slide.pitch}</p>
          {slide.handle ? (
            <p className="cr-ig-author-handle">
              <InstagramMark />
              {slide.handle}
            </p>
          ) : null}
          {slide.handle ? (
            <p className="cr-ig-author-follow">Follow {slide.firstName} for more inspiration</p>
          ) : null}
          <p className="cr-ig-author-save">Save this guide for your next adventure.</p>
          <p className="cr-ig-author-discover">
            Discover more on <strong>venturo.co.za</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
