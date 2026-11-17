"use client";

const FALLBACK = "/brand/vee/venturo-activity-digital.png";

export type MediaGuidance = {
  recommended?: string;
  accept?: string;
  maxMb?: number;
  transparentOk?: boolean;
};

export function MediaUploadField({
  label = "Artwork",
  url,
  busy,
  guidance,
  onFile,
  showLightDark = true,
}: {
  label?: string;
  url: string | null | undefined;
  busy?: boolean;
  guidance?: MediaGuidance;
  onFile: (file: File) => void;
  showLightDark?: boolean;
}) {
  const accept = guidance?.accept ?? "image/png,image/jpeg,image/webp";
  const maxMb = guidance?.maxMb ?? 1;
  const src = url || FALLBACK;

  return (
    <div className="cr-manage-media">
      <p className="cr-manage-legend">{label}</p>
      {showLightDark ? (
        <div className="cr-manage-media-previews">
          <span className="cr-manage-media-swatch is-light" title="Snow Drift">
            <img src={src} alt="" width={72} height={72} />
          </span>
          <span className="cr-manage-media-swatch is-dark" title="Night Sky">
            <img src={src} alt="" width={72} height={72} />
          </span>
        </div>
      ) : (
        <div className="cr-manage-media-single">
          <img src={src} alt="" />
        </div>
      )}
      <p className="muted cr-manage-hint">
        {guidance?.recommended ?? "Square PNG or WebP preferred."}
        {guidance?.transparentOk ? " Transparent PNG is supported." : ""}
        {` Max ${maxMb} MB.`}
      </p>
      <label className={`btn btn-secondary${busy ? " is-busy" : ""}`}>
        {busy ? "Uploading…" : url ? "Replace image" : "Upload image"}
        <input
          hidden
          type="file"
          accept={accept}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>
    </div>
  );
}
