import type { Ref } from "react";
import {
  GuideExportChip,
  GuideExportCta,
  GuideExportShell,
} from "@/components/admin/guide-export/GuideExportShell";
import type { GuideExportSlide } from "@/components/admin/guide-export/types";

const INTRO_ACCENT = "#F3BF4A";

export function GuideExportIntroCard({
  slide,
  frameRef,
}: {
  slide: Extract<GuideExportSlide, { kind: "intro" }>;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const lede =
    slide.intro ||
    (slide.spotCount > 0
      ? `${slide.spotCount} hand-picked spot${slide.spotCount === 1 ? "" : "s"} from the Venturo directory.`
      : "Hand-picked spots from the Venturo directory.");

  return (
    <GuideExportShell
      frameRef={frameRef}
      accent={INTRO_ACCENT}
      ink="night"
      image={slide.cover}
      title={slide.title}
      band={
        <>
          <p className="cr-ig-lede">{lede}</p>
          <div className="cr-ig-chips">
            <GuideExportChip
              primary={slide.spotCount === 1 ? "1 spot" : `${slide.spotCount} spots`}
            />
            <GuideExportChip primary="Hand-picked" />
          </div>
          <GuideExportCta />
        </>
      }
    />
  );
}
