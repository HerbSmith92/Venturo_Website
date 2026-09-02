import type { Ref } from "react";
import {
  GuideExportShell,
  titleSizeFor,
} from "@/components/admin/guide-export/GuideExportShell";
import {
  padSlideIndex,
  type GuideExportSlide,
} from "@/components/admin/guide-export/types";

export function GuideExportActivityCard({
  slide,
  frameRef,
}: {
  slide: Extract<GuideExportSlide, { kind: "activity" }>;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const pager =
    slide.spotCount > 0
      ? `${padSlideIndex(slide.index)} / ${padSlideIndex(slide.spotCount)}`
      : null;

  return (
    <GuideExportShell
      frameRef={frameRef}
      accent={slide.accent}
      image={slide.image}
      title={slide.name}
      tagline={slide.description}
      titleSize={titleSizeFor(slide.name)}
      pager={pager ?? undefined}
      heroClassName="cr-ig-hero-spot"
      band={
        <>
          <div className="cr-ig-facts">
            {slide.facts.map((fact) => (
              <div
                key={`${fact.icon}-${fact.label}`}
                className={`cr-ig-fact${fact.wrap ? " cr-ig-fact-wrap" : ""}`}
              >
                <span className="cr-ig-fact-icon" aria-hidden>
                  {fact.icon}
                </span>
                <span className="cr-ig-fact-label">{fact.label}</span>
              </div>
            ))}
          </div>

          {slide.tip ? (
            <div className="cr-ig-tip">
              <p className="cr-ig-tip-label">Venturo Tip 💡</p>
              <p className="cr-ig-tip-copy">{slide.tip}</p>
            </div>
          ) : null}

          <p className="cr-ig-cta">Find it on Venturo →</p>
        </>
      }
    />
  );
}
