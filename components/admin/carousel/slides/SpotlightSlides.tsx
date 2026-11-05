import { Fragment, type CSSProperties, type ReactNode, type Ref } from "react";
import { exportPhotoSrc } from "@/lib/export-image";
import { GuideExportWave } from "@/components/admin/guide-export/GuideExportShell";
import {
  CAROUSEL_FOOTER,
  cropStyle,
  spotlightBackdrop,
  spotlightInkCss,
  spotlightPostAlign,
  spotlightSlideCount,
  spotlightTemplate,
  spotlightTypeStyle,
  wordCount,
  type CarouselAuthor,
  type CarouselCover,
  type CarouselRec,
  type SlideBackdrop,
  type SpotlightSlideTemplate,
} from "@/lib/guide-carousel";

const JADE = "#45A67F";

type FrameVariant = SpotlightSlideTemplate | "cover";

function sameLine(a: string, b: string) {
  return a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatCopy(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={index}>{bold[1]}</strong>;
    const italic = part.match(/^\*([^*]+)\*$/);
    if (italic) return <em key={index}>{italic[1]}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function FormattedCopy({
  text,
  className,
  rec,
  role,
  as = "p",
  fit,
}: {
  text: string;
  className?: string;
  rec: CarouselRec;
  role: "heading" | "kicker" | "body" | "pack";
  as?: "p" | "h3";
  fit?: boolean;
}) {
  const stylePack = spotlightTypeStyle(rec, role);
  const style: CSSProperties = {
    fontSize: `${stylePack.size}px`,
    color: spotlightInkCss(stylePack.ink),
    fontWeight: stylePack.bold ? 700 : undefined,
    fontStyle: stylePack.italic ? "italic" : undefined,
    textDecoration: stylePack.underline ? "underline" : undefined,
    textAlign: stylePack.align === "centre" ? "center" : stylePack.align,
    lineHeight: stylePack.lineSpace,
  };
  const Tag = as;
  return (
    <Tag className={className} data-ig-fit={fit ? "description" : undefined} style={style}>
      {formatCopy(text)}
    </Tag>
  );
}

function Frame({
  title,
  count,
  image,
  crop,
  frameRef,
  variant,
  backdrop,
  backdropColour,
  children,
}: {
  title: string;
  count?: string;
  image: string;
  crop: CarouselCover["crop"] | CarouselRec["crop"];
  frameRef?: Ref<HTMLDivElement>;
  variant: FrameVariant;
  backdrop?: SlideBackdrop;
  backdropColour?: string;
  children?: ReactNode;
}) {
  const imageBack = variant === "overlay" || (variant === "copy" && backdrop === "image");
  const showPhoto = variant !== "copy" || imageBack;
  const showBand = variant === "cover" || variant === "combined";
  const showCopy = variant !== "photo";
  const colourBack = variant === "copy" && backdrop === "colour";
  return (
    <div
      className={`cr-ig-frame ig-spot is-${variant}${imageBack && variant === "copy" ? " has-image-back" : ""}${colourBack ? " has-colour-back" : ""}`}
      ref={frameRef}
      style={{
        ["--cr-ig-accent" as string]: JADE,
        background: colourBack ? backdropColour || JADE : undefined,
      }}
    >
      {showPhoto ? (
        <div className="ig-spot-photo">
          <img src={exportPhotoSrc(image)} alt="" decoding="sync" loading="eager" style={cropStyle(crop)} />
        </div>
      ) : null}
      {imageBack ? <div className="ig-spot-scrim" /> : null}
      <header className="ig-spot-head">
        <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="" />
        <h2>{title}</h2>
        {count ? <p>{count}</p> : null}
      </header>
      {variant === "photo" ? <p className="ig-spot-photo-foot">{CAROUSEL_FOOTER}</p> : null}
      {showCopy ? (
        showBand ? (
          <div className="ig-spot-band">
            <GuideExportWave />
            <div className="ig-spot-copy">{children}</div>
          </div>
        ) : (
          <div className="ig-spot-copy">{children}</div>
        )
      ) : null}
    </div>
  );
}

function StoryCopy({ rec, listingName, fill }: { rec: CarouselRec; listingName: string; fill?: boolean }) {
  const pack = rec.role === "pack";
  const heading = rec.title.replace(/\s+$/g, "").replace(/^\s+/g, "");
  const showHeading = Boolean(heading) && !sameLine(heading, listingName);
  const packLine = rec.tip.replace(/\s+$/g, "").replace(/^\s+/g, "");
  const body = rec.description.replace(/\s+$/g, "").replace(/^\s+/g, "");
  return (
    <>
      <div className={`ig-spot-stack is-${spotlightPostAlign(rec)}`}>
        {showHeading ? (
          <FormattedCopy
            text={heading}
            className={wordCount(heading) > 8 ? "is-long" : undefined}
            rec={rec}
            role="heading"
            as="h3"
          />
        ) : null}
        {pack && packLine ? (
          <FormattedCopy text={packLine} className="ig-spot-pack" rec={rec} role="pack" />
        ) : null}
        {body ? (
          <FormattedCopy
            text={body}
            className={pack ? "ig-spot-support" : "ig-spot-body"}
            rec={rec}
            role="body"
            fit={!fill}
          />
        ) : null}
      </div>
      <p className="ig-spot-foot">
        <span>{CAROUSEL_FOOTER}</span>
        {rec.credit ? <span>{rec.credit}</span> : null}
      </p>
    </>
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
      variant="cover"
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
  listingName,
  frameRef,
}: {
  rec: CarouselRec;
  index: number;
  recCount: number;
  listingName: string;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const template = spotlightTemplate(rec);
  const header = listingName.trim() || rec.title;
  return (
    <Frame
      variant={template}
      title={header}
      count={spotlightSlideCount(index + 2, recCount)}
      image={rec.image}
      crop={rec.crop}
      backdrop={spotlightBackdrop(rec)}
      backdropColour={rec.backdropColour}
      frameRef={frameRef}
    >
      {template === "photo" ? null : (
        <StoryCopy rec={rec} listingName={header} fill={template === "copy"} />
      )}
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
  listingName,
  frameRef,
}: {
  author: CarouselAuthor;
  listingName?: string;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const cover = author.cover.trim();
  const header = listingName?.trim() || author.kicker || "Meet your guide";
  return (
    <div className={`cr-ig-frame ig-spot ig-spot-author${cover ? " has-cover" : ""}`} ref={frameRef} style={{ ["--cr-ig-accent" as string]: JADE }}>
      <div className="ig-spot-author-sky">
        {cover ? <img className="ig-spot-author-cover" src={exportPhotoSrc(cover)} alt="" decoding="sync" loading="eager" /> : null}
        <header className="ig-spot-head">
          <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="" />
          <h2>{header}</h2>
        </header>
        {listingName?.trim() && author.kicker ? <p className="ig-spot-author-kicker">{author.kicker}</p> : null}
        <div className="ig-spot-portrait">
          {author.photo ? (
            <img src={exportPhotoSrc(author.photo)} alt="" decoding="sync" loading="eager" />
          ) : (
            <span>{initials(author.name) || "?"}</span>
          )}
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
