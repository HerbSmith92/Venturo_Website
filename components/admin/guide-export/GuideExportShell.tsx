import type { ReactNode, Ref } from "react";

export function GuideExportWave() {
  return (
    <svg className="cr-ig-wave" viewBox="0 0 1080 96" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 62
          C150 110, 270 8, 390 52
          C510 96, 630 10, 750 58
          C870 104, 970 18, 1080 62
          L1080 96 L0 96 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function GuideExportChip({
  primary,
  secondary,
  tall,
}: {
  primary: string;
  secondary?: string | string[];
  tall?: boolean;
}) {
  const lines = Array.isArray(secondary)
    ? secondary.filter(Boolean)
    : secondary
      ? [secondary]
      : [];

  return (
    <div className={`cr-ig-chip${tall ? " cr-ig-chip-tall" : ""}`}>
      <p className="cr-ig-chip-primary">{primary}</p>
      {lines.map((line) => (
        <p key={line} className="cr-ig-chip-secondary">
          {line}
        </p>
      ))}
    </div>
  );
}

export function GuideExportShell({
  frameRef,
  accent,
  image,
  title,
  tagline,
  band,
  pager,
  titleSize = "md",
  heroClassName,
}: {
  frameRef?: Ref<HTMLDivElement>;
  accent: string;
  image: string;
  title: string;
  tagline: string;
  band: ReactNode;
  pager?: string;
  titleSize?: "sm" | "md" | "lg";
  heroClassName?: string;
}) {
  return (
    <div
      className="cr-ig-frame cr-ig-event"
      ref={frameRef}
      style={{ ["--cr-ig-accent" as string]: accent }}
    >
      <div className="cr-ig-bg">
        <img src={image} alt="" crossOrigin="anonymous" />
        <div className="cr-ig-bg-scrim" />
      </div>

      <div className="cr-ig-badge" aria-hidden>
        <img src="/brand/logos/venturo-stacked-simple-dark.svg" alt="" />
      </div>

      <div className={`cr-ig-hero${heroClassName ? ` ${heroClassName}` : ""}`}>
        <h2 className={`cr-ig-hero-title cr-ig-hero-title-${titleSize}`}>{title}</h2>
        {tagline ? <p className="cr-ig-hero-tagline">{tagline}</p> : null}
        {pager ? <p className="cr-ig-pager-mark">{pager}</p> : null}
      </div>

      <div className="cr-ig-band">
        <GuideExportWave />
        <div className="cr-ig-band-inner">{band}</div>
      </div>
    </div>
  );
}

export function titleSizeFor(text: string): "sm" | "md" | "lg" {
  const len = text.trim().length;
  if (len <= 18) return "lg";
  if (len <= 36) return "md";
  return "sm";
}
