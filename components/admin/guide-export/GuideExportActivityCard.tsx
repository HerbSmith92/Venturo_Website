import type { Ref } from "react";
import {
  GuideExportChip,
  GuideExportCta,
  GuideExportShell,
} from "@/components/admin/guide-export/GuideExportShell";
import type { GuideExportSlide } from "@/components/admin/guide-export/types";

export function GuideExportActivityCard({
  slide,
  frameRef,
}: {
  slide: Extract<GuideExportSlide, { kind: "activity" }>;
  frameRef?: Ref<HTMLDivElement>;
}) {
  return (
    <GuideExportShell
      frameRef={frameRef}
      accent={slide.accent}
      ink={slide.ink}
      image={slide.image}
      title={slide.name}
      band={
        <>
          {slide.category ? <p className="cr-ig-category">{slide.category}</p> : null}
          {slide.description ? <p className="cr-ig-lede">{slide.description}</p> : null}
          <div className="cr-ig-chips">
            <GuideExportChip icon="pin" primary={slide.area} />
            <GuideExportChip primary={slide.price} />
          </div>
          <GuideExportCta />
        </>
      }
    />
  );
}
