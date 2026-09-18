import jsQR from "jsqr";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
};

function getBarcodeDetector():
  | (new (options?: { formats: string[] }) => BarcodeDetectorLike)
  | null {
  if (typeof window === "undefined") return null;
  return (
    (
      window as unknown as {
        BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
      }
    ).BarcodeDetector ?? null
  );
}

export function createQrDetector() {
  const Detector = getBarcodeDetector();
  const native = Detector ? new Detector({ formats: ["qr_code"] }) : null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  return async function detectQr(video: HTMLVideoElement): Promise<string | null> {
    if (native) {
      try {
        const codes = await native.detect(video);
        const value = codes[0]?.rawValue?.trim();
        if (value) return value;
      } catch {
        // Fall through to jsQR — some browsers expose BarcodeDetector but fail on video frames.
      }
    }

    if (!ctx) return null;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    const crop = 0.12;
    const sx = width * crop;
    const sy = height * crop;
    const sw = width * (1 - crop * 2);
    const sh = height * (1 - crop * 2);
    const targetW = 480;
    const targetH = Math.max(1, Math.round((targetW * sh) / sw));
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
    const image = ctx.getImageData(0, 0, targetW, targetH);
    const result = jsQR(image.data, targetW, targetH, { inversionAttempts: "attemptBoth" });
    return result?.data?.trim() || null;
  };
}
