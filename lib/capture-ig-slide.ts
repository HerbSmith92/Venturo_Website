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
  return new Promise<void>((resolve, reject) => {
    const ok = () => resolve();
    const fail = () => reject(new Error("A photograph did not load."));
    img.addEventListener("load", ok, { once: true });
    img.addEventListener("error", fail, { once: true });
  });
}

function absoluteSrc(img: HTMLImageElement) {
  const raw = img.currentSrc || img.getAttribute("src") || "";
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  try {
    return new URL(raw, window.location.href).href;
  } catch {
    return raw;
  }
}

function isSlidePhoto(img: HTMLImageElement) {
  return Boolean(
    img.closest(
      ".ig-spot-photo, .cr-ig-bg, .ig-author-cover, .ig-spot-author-cover, .ig-spot-portrait, .ig-author-portrait, .cr-ig-author-portrait, .ig-cover-photo, .ig-rec-photo",
    ),
  );
}

async function inlineImages(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      const src = absoluteSrc(img);
      if (!src || src.startsWith("data:")) return;
      img.setAttribute("decoding", "sync");
      img.setAttribute("loading", "eager");
      img.removeAttribute("crossorigin");
      try {
        const response = await fetch(src, { credentials: "include", cache: "no-store" });
        if (!response.ok) {
          if (isSlidePhoto(img)) throw new Error("A photograph did not load.");
          return;
        }
        const blob = await response.blob();
        const type = blob.type || (src.includes(".svg") ? "image/svg+xml" : "");
        if (type && !type.startsWith("image/") && type !== "image/svg+xml") {
          if (isSlidePhoto(img)) throw new Error("A photograph did not load.");
          return;
        }
        img.src = await blobToDataUrl(blob);
        if ("decode" in img) await img.decode().catch(() => waitForImage(img));
        else await waitForImage(img);
      } catch (error) {
        if (isSlidePhoto(img)) throw error instanceof Error ? error : new Error("A photograph did not load.");
      }
    }),
  );
}

function paintHost() {
  const host = document.createElement("div");
  host.setAttribute("data-ig-capture-host", "true");
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:1080px",
    "height:1350px",
    "opacity:0.02",
    "pointer-events:none",
    "z-index:2147483646",
    "overflow:hidden",
  ].join(";");
  document.body.appendChild(host);
  return host;
}

function frames() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

const CAPTURE_STYLE = {
  transform: "none",
  left: "0",
  top: "0",
  opacity: "1",
  position: "relative" as const,
  width: `${IG_POST_WIDTH}px`,
  height: `${IG_POST_HEIGHT}px`,
};

export async function captureIgSlide(node: HTMLElement) {
  if (document.fonts?.ready) await document.fonts.ready;
  const host = paintHost();
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.opacity = "1";
  clone.style.position = "relative";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.width = `${IG_POST_WIDTH}px`;
  clone.style.height = `${IG_POST_HEIGHT}px`;
  host.appendChild(clone);
  try {
    await inlineImages(clone);
    await frames();
    const photos = clone.querySelectorAll<HTMLImageElement>("img");
    for (const photo of photos) {
      if (isSlidePhoto(photo) && photo.naturalWidth === 0 && photo.getAttribute("src")) {
        throw new Error("A photograph did not load.");
      }
    }
    const blob = await toBlob(clone, {
      cacheBust: false,
      includeQueryParams: true,
      pixelRatio: 1,
      skipAutoScale: true,
      canvasWidth: IG_POST_WIDTH,
      canvasHeight: IG_POST_HEIGHT,
      width: IG_POST_WIDTH,
      height: IG_POST_HEIGHT,
      fetchRequestInit: { credentials: "include", cache: "no-store" },
      style: CAPTURE_STYLE,
    });
    if (!blob) throw new Error("Empty export");
    return blob;
  } finally {
    host.remove();
  }
}

export { downloadBlob };
