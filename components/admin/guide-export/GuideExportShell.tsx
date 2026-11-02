import type { ReactNode, Ref } from "react";

export function GuideExportWave() {
  return (
    <svg className="cr-ig-wave" viewBox="0 0 1080 120" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 54
          C210 8, 390 108, 560 62
          C730 16, 900 96, 1080 48
          L1080 120 L0 120 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PinMark() {
  return (
    <svg viewBox="0 0 24 24" className="cr-ig-chip-mark" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.5c-3.7 0-6.7 2.9-6.7 6.5 0 4.6 5.4 10.8 6.3 11.8.2.2.6.2.8 0 .9-1 6.3-7.2 6.3-11.8 0-3.6-3-6.5-6.7-6.5Zm0 8.8a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6Z"
      />
    </svg>
  );
}

export function GuideExportChip({
  primary,
  icon,
}: {
  primary: string;
  icon?: "pin";
}) {
  return (
    <div className="cr-ig-chip">
      {icon === "pin" ? <PinMark /> : null}
      <p className="cr-ig-chip-primary">{primary}</p>
    </div>
  );
}

export function GuideExportCta() {
  return (
    <div className="cr-ig-cta-row">
      <p className="cr-ig-cta">Find it on Venturo →</p>
      <p className="cr-ig-domain">venturo.co.za</p>
    </div>
  );
}

export function GuideExportShell({
  frameRef,
  accent,
  ink,
  image,
  title,
  band,
}: {
  frameRef?: Ref<HTMLDivElement>;
  accent: string;
  ink: "night" | "snow";
  image: string;
  title: string;
  band: ReactNode;
}) {
  return (
    <div
      className="cr-ig-frame cr-ig-event"
      ref={frameRef}
      data-ink={ink}
      style={{ ["--cr-ig-accent" as string]: accent }}
    >
      <div className="cr-ig-bg">
        <img src={image} alt="" crossOrigin="anonymous" />
      </div>

      <header className="cr-ig-head">
        <img
          className="cr-ig-head-logo"
          src="/brand/logos/venturo-stacked-simple-light.svg"
          alt=""
        />
        <span className="cr-ig-head-rule" aria-hidden />
        <h2 className="cr-ig-head-title">{title}</h2>
      </header>

      <div className="cr-ig-band">
        <GuideExportWave />
        <div className="cr-ig-band-inner">{band}</div>
      </div>
    </div>
  );
}
