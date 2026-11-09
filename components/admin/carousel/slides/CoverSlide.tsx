import type { Ref } from "react";
import { exportPhotoSrc } from "@/lib/export-image";
import {
  cropStyle,
  formatCoverDates,
  spotlightAccent,
  wordCount,
  type CarouselCover,
  type CarouselCrop,
} from "@/lib/guide-carousel";
import { GuideExportWave } from "@/components/admin/guide-export/GuideExportShell";

function stackHeadline(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("\n")) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 3) return trimmed;
  return `${parts.slice(0, -1).join(" ")}\n${parts[parts.length - 1]}`;
}

export function CoverSlide({
  cover,
  count,
  accent,
  frameRef,
}: {
  cover: CarouselCover;
  count: number;
  accent?: string;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const collage = cover.layout === "collage";
  const photos = collage ? cover.collage : [cover.image];
  const dates = formatCoverDates(cover.dateFrom, cover.dateTo) || cover.dateRange;
  const cropFor = (index: number): CarouselCrop =>
    collage ? (cover.collageCrops?.[index] ?? cover.crop) : cover.crop;
  return (
    <div
      className="cr-ig-frame ig-cover"
      ref={frameRef}
      style={{ ["--cr-ig-accent" as string]: spotlightAccent(accent) }}
    >
      <header className="ig-cover-head">
        <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="" />
        {cover.seriesLabel ? <p>{cover.seriesLabel}</p> : null}
      </header>
      <div className={`ig-cover-photos ${collage ? "is-collage" : "is-hero"}`}>
        {photos.map((src, index) => (
          <div className="ig-cover-photo" key={`${src}-${index}`}>
            <img src={exportPhotoSrc(src)} alt="" decoding="sync" loading="eager" style={cropStyle(cropFor(index))} />
          </div>
        ))}
      </div>
      <div className="ig-cover-band">
        <GuideExportWave />
        <div className="ig-cover-copy">
          <h2 className={wordCount(cover.headline) > 6 ? "is-long" : undefined} data-ig-fit="headline">
            {stackHeadline(cover.headline || `${count} Weekend Adventures`)}
          </h2>
          <p className="ig-cover-geo">
            {cover.geoLabel}
            {dates ? ` · ${dates}` : ""}
          </p>
          {cover.supporting ? <p className="ig-cover-support">{cover.supporting}</p> : null}
          <p className="ig-cover-swipe">{cover.swipePrompt}</p>
        </div>
      </div>
    </div>
  );
}
