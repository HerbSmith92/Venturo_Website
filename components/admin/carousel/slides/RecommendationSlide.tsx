import type { Ref } from "react";
import { exportPhotoSrc } from "@/lib/export-image";
import {
  CAROUSEL_FOOTER,
  accentForCategory,
  cropStyle,
  formatSocialPrice,
  inkForAccent,
  padRecIndex,
  type CarouselRec,
} from "@/lib/guide-carousel";
import { GuideExportWave } from "@/components/admin/guide-export/GuideExportShell";

function formatEventWhen(rec: CarouselRec) {
  if (!rec.eventDate) return "";
  const date = new Date(`${rec.eventDate}T12:00:00+02:00`);
  const day = Number.isNaN(date.getTime())
    ? rec.eventDate
    : new Intl.DateTimeFormat("en-ZA", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Africa/Johannesburg",
      }).format(date).toUpperCase();
  const time = [rec.eventStart, rec.eventEnd].filter(Boolean).join("–");
  return time ? `${day} · ${time}` : day;
}

export function RecommendationSlide({
  rec,
  index,
  total,
  frameRef,
}: {
  rec: CarouselRec;
  index: number;
  total: number;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const accent = accentForCategory(rec.categoryKey);
  const ink = inkForAccent(accent);
  const price = formatSocialPrice(rec.priceAmount, rec.priceBasis, rec.priceNote);
  const when = rec.kind === "event" ? formatEventWhen(rec) : "";
  const details = [rec.location, price].filter(Boolean);

  return (
    <div className="cr-ig-frame ig-rec" ref={frameRef} data-ink={ink} style={{ ["--cr-ig-accent" as string]: accent }}>
      <header className="ig-rec-head">
        <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="" />
        <h2>{rec.title}</h2>
        <p>{padRecIndex(index, total)}</p>
      </header>
      <div className="ig-rec-photo">
        <img src={exportPhotoSrc(rec.image)} alt="" style={cropStyle(rec.crop)} />
      </div>
      <div className="ig-rec-band">
        <GuideExportWave />
        <div className="ig-rec-copy">
          {when ? <p className="ig-rec-when">{when}</p> : null}
          <p className="ig-rec-cat">{rec.categoryTitle}</p>
          <p className="ig-rec-desc" data-ig-fit="description">{rec.description}</p>
          {details.length ? <p className="ig-rec-meta">{details.join(" · ")}</p> : null}
          {rec.tip ? <p className="ig-rec-tip">{rec.tip}</p> : null}
          <p className="ig-rec-foot">{CAROUSEL_FOOTER}</p>
        </div>
      </div>
    </div>
  );
}
