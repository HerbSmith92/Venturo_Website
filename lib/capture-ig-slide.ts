import { toBlob } from "html-to-image";
import { IG_POST_HEIGHT, IG_POST_WIDTH } from "@/lib/guide-carousel";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function waitForImage(img: HTMLImageElement) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

async function inlineImages(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return;
      const response = await fetch(src, { credentials: "same-origin", cache: "force-cache" });
      if (!response.ok) return;
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) return;
      img.src = await blobToDataUrl(blob);
      await waitForImage(img);
    }),
  );
}

export async function captureIgSlide(node: HTMLElement) {
  if (document.fonts?.ready) await document.fonts.ready;
  await inlineImages(node);
  const photos = node.querySelectorAll<HTMLImageElement>("img");
  for (const photo of photos) {
    if (photo.naturalWidth === 0 && photo.getAttribute("src")) {
      throw new Error("A photograph did not load.");
    }
  }
  const blob = await toBlob(node, {
    cacheBust: false,
    pixelRatio: 1,
    skipAutoScale: true,
    canvasWidth: IG_POST_WIDTH,
    canvasHeight: IG_POST_HEIGHT,
    width: IG_POST_WIDTH,
    height: IG_POST_HEIGHT,
    style: {
      transform: "none",
      left: "0",
      top: "0",
      opacity: "1",
      position: "relative",
      width: `${IG_POST_WIDTH}px`,
      height: `${IG_POST_HEIGHT}px`,
    },
  });
  if (!blob) throw new Error("Empty export");
  return blob;
}

export { downloadBlob };
