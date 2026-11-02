import type { Ref } from "react";
import { exportPhotoSrc } from "@/lib/export-image";
import { CAROUSEL_FOOTER, type CarouselAuthor } from "@/lib/guide-carousel";
import { GuideExportWave } from "@/components/admin/guide-export/GuideExportShell";

function stackClosing(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("\n")) return trimmed;
  return trimmed.replace(/\s+Starts Here\.?$/i, "\nStarts Here.");
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function AuthorSlide({
  author,
  frameRef,
}: {
  author: CarouselAuthor;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const compact = author.compactLayout;
  return (
    <div className={`cr-ig-frame ig-author${compact ? " is-compact" : ""}${author.cover ? " has-cover" : ""}`} ref={frameRef}>
      <div className="ig-author-sky">
        {author.cover ? (
          <img className="ig-author-cover" src={exportPhotoSrc(author.cover)} alt="" />
        ) : null}
        <header className="ig-author-head">
          <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="" />
          <p>{author.kicker || "Meet your guide"}</p>
        </header>
        <div className="ig-author-identity">
          <div className="ig-author-portrait">
            {author.photo ? (
              <img src={exportPhotoSrc(author.photo)} alt="" />
            ) : (
              <span>{initials(author.name) || "?"}</span>
            )}
          </div>
          <h2>{author.name || "Assign an author"}</h2>
          {author.bio ? <p className="ig-author-bio">{author.bio}</p> : null}
        </div>
      </div>
      <div className="ig-author-band">
        <GuideExportWave />
        <div className="ig-author-copy">
          <h3>{stackClosing(author.closing)}</h3>
          <p className="ig-author-primary">{author.primaryAction}</p>
          <p className="ig-author-support">{author.supportingAction}</p>
          <p className="ig-author-foot">
            {author.handle || CAROUSEL_FOOTER} · venturo.co.za
          </p>
        </div>
      </div>
    </div>
  );
}
