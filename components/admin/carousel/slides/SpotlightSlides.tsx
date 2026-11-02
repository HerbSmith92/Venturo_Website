import type { ReactNode, Ref } from "react";
import { exportPhotoSrc } from "@/lib/export-image";
import { GuideExportWave } from "@/components/admin/guide-export/GuideExportShell";
import {
  CAROUSEL_FOOTER,
  cropStyle,
  spotlightSlideCount,
  wordCount,
  type CarouselAuthor,
  type CarouselCover,
  type CarouselRec,
} from "@/lib/guide-carousel";

const JADE = "#45A67F";

function Frame({
  title,
  count,
  image,
  crop,
  frameRef,
  children,
}: {
  title: string;
  count?: string;
  image: string;
  crop: CarouselCover["crop"] | CarouselRec["crop"];
  frameRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div className="cr-ig-frame ig-spot" ref={frameRef} style={{ ["--cr-ig-accent" as string]: JADE }}>
      <div className="ig-spot-photo">
        <img src={exportPhotoSrc(image)} alt="" style={cropStyle(crop)} />
      </div>
      <header className="ig-spot-head">
        <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="" />
        <h2>{title}</h2>
        {count ? <p>{count}</p> : null}
      </header>
      <div className="ig-spot-band">
        <GuideExportWave />
        <div className="ig-spot-copy">{children}</div>
      </div>
    </div>
  );
}

export function SpotlightCoverSlide({
  cover,
  recCount,
  frameRef,
}: {
  cover: CarouselCover;
  recCount: number;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const long = wordCount(cover.headline) > 8;
  return (
    <Frame
      title={cover.headerTitle || cover.headline}
      count={spotlightSlideCount(1, recCount)}
      image={cover.image}
      crop={cover.crop}
      frameRef={frameRef}
    >
      {cover.seriesLabel ? <p className="ig-spot-kicker">{cover.seriesLabel}</p> : null}
      <h3 className={long ? "is-long" : undefined} data-ig-fit="headline">
        {cover.headline}
      </h3>
      {cover.supporting ? <p className="ig-spot-support">{cover.supporting}</p> : null}
      {cover.geoLabel ? <p className="ig-spot-geo">{cover.geoLabel}</p> : null}
      <p className="ig-spot-foot">
        <span>{CAROUSEL_FOOTER}</span>
        <span>{cover.swipePrompt || "Swipe to explore →"}</span>
      </p>
    </Frame>
  );
}

export function SpotlightStorySlide({
  rec,
  index,
  recCount,
  frameRef,
}: {
  rec: CarouselRec;
  index: number;
  recCount: number;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const pack = rec.role === "pack";
  return (
    <Frame
      title={rec.title}
      count={spotlightSlideCount(index + 2, recCount)}
      image={rec.image}
      crop={rec.crop}
      frameRef={frameRef}
    >
      {rec.kicker ? <p className="ig-spot-kicker">{rec.kicker}</p> : null}
      {pack && rec.tip ? <p className="ig-spot-pack">{rec.tip}</p> : null}
      {rec.description ? (
        <p className={pack ? "ig-spot-support" : "ig-spot-body"} data-ig-fit="description">
          {rec.description}
        </p>
      ) : null}
      <p className="ig-spot-foot">
        <span>{CAROUSEL_FOOTER}</span>
        {rec.credit ? <span>{rec.credit}</span> : null}
      </p>
    </Frame>
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

export function SpotlightAuthorSlide({
  author,
  frameRef,
}: {
  author: CarouselAuthor;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const cover = author.cover.trim();
  return (
    <div className={`cr-ig-frame ig-spot ig-spot-author${cover ? " has-cover" : ""}`} ref={frameRef} style={{ ["--cr-ig-accent" as string]: JADE }}>
      <div className="ig-spot-author-sky">
        {cover ? <img className="ig-spot-author-cover" src={exportPhotoSrc(cover)} alt="" /> : null}
        <header className="ig-spot-head">
          <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="" />
          <h2>{author.kicker || "Meet your guide"}</h2>
        </header>
        <div className="ig-spot-portrait">
          {author.photo ? <img src={exportPhotoSrc(author.photo)} alt="" /> : <span>{initials(author.name) || "?"}</span>}
        </div>
        <h3>{author.name || "Assign an author"}</h3>
        {author.tagline || author.bio ? <p className="ig-spot-tagline">{author.tagline || author.bio}</p> : null}
      </div>
      <div className="ig-spot-band">
        <GuideExportWave />
        <div className="ig-spot-copy">
          <h3 className="ig-spot-closing">{author.closing || "Your next plan starts here."}</h3>
          {author.primaryAction ? <p className="ig-spot-support">{author.primaryAction}</p> : null}
          {author.supportingAction ? <p className="ig-spot-geo">{author.supportingAction}</p> : null}
          <p className="ig-spot-foot">
            <span>
              {CAROUSEL_FOOTER} · venturo.co.za
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
