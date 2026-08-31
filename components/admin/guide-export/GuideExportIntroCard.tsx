import type { Ref } from "react";
import {
  GuideExportChip,
  GuideExportShell,
  titleSizeFor,
} from "@/components/admin/guide-export/GuideExportShell";
import type { GuideExportSlide } from "@/components/admin/guide-export/types";

const INTRO_ACCENT = "#F3BF4A"; // Cheerful Canary

export function GuideExportIntroCard({
  slide,
  frameRef,
}: {
  slide: Extract<GuideExportSlide, { kind: "intro" }>;
  frameRef?: Ref<HTMLDivElement>;
}) {
  const rawTagline =
    slide.intro ||
    (slide.spotCount > 0
      ? `${slide.spotCount} hand-picked spot${slide.spotCount === 1 ? "" : "s"} from the Venturo directory.`
      : "Hand-picked spots from the Venturo directory.");
  const tagline =
    rawTagline.length > 110 ? `${rawTagline.slice(0, 107).trimEnd()}…` : rawTagline;

  const spotLabel = slide.spotCount === 1 ? "1 SPOT" : `${slide.spotCount} SPOTS`;

  return (
    <GuideExportShell
      frameRef={frameRef}
      accent={INTRO_ACCENT}
      image={slide.cover}
      title={slide.title}
      tagline={tagline}
      titleSize={titleSizeFor(slide.title)}
      band={
        <>
          <div className="cr-ig-chips">
            <div className="cr-ig-chip-col">
              <GuideExportChip primary={spotLabel} secondary="Hand-picked" />
              <GuideExportChip primary="FREE TO BROWSE" />
            </div>
            <GuideExportChip
              tall
              primary="VENTURO GUIDE"
              secondary={["From the directory", "Worth getting out for"]}
            />
          </div>
          <p className="cr-ig-footer">venturo.co.za</p>
        </>
      }
    />
  );
}
