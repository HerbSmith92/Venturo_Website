"use client";

import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { GuideExportActivityCard } from "@/components/admin/guide-export/GuideExportActivityCard";
import { GuideExportIntroCard } from "@/components/admin/guide-export/GuideExportIntroCard";
import {
  IG_POST_HEIGHT,
  IG_POST_WIDTH,
  buildGuideExportSlides,
  exportFileSlug,
  type GuideExportSlide,
} from "@/components/admin/guide-export/types";
import type { GuideDraftItem } from "@/lib/guide-shared";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function dataUrlToBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(header)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function captureFrame(node: HTMLElement) {
  return toPng(node, {
    cacheBust: true,
    pixelRatio: 1,
    width: IG_POST_WIDTH,
    height: IG_POST_HEIGHT,
    style: {
      transform: "none",
      width: `${IG_POST_WIDTH}px`,
      height: `${IG_POST_HEIGHT}px`,
    },
  });
}

export function GuideExportModal({
  open,
  title,
  intro,
  items,
  onClose,
}: {
  open: boolean;
  title: string;
  intro: string;
  items: GuideDraftItem[];
  onClose: () => void;
}) {
  const slides = useMemo(
    () => buildGuideExportSlides({ title, intro, items }),
    [title, intro, items],
  );
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<"one" | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const bankRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.32);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setError(null);
    setBusy(null);
    bankRefs.current = [];
  }, [open, title, intro, items]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((current) => Math.min(current + 1, slides.length - 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(current - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, slides.length]);

  useEffect(() => {
    if (!open) return;
    const stage = stageRef.current;
    if (!stage) return;

    function updateScale() {
      if (!stage) return;
      const pad = 24;
      const availableW = Math.max(160, stage.clientWidth - pad);
      const availableH = Math.max(200, stage.clientHeight - pad);
      const next = Math.min(availableW / IG_POST_WIDTH, availableH / IG_POST_HEIGHT, 0.55);
      setScale(Math.max(0.18, next));
    }

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [open]);

  if (!open) return null;

  const slide = slides[index] ?? slides[0];
  const slug = exportFileSlug(title);
  const label =
    slide.kind === "intro" ? "Intro Card" : `Spot ${slide.index} · ${slide.name}`;

  async function downloadCurrent() {
    const node = bankRefs.current[index] ?? previewRef.current;
    if (!node) return;
    setBusy("one");
    setError(null);
    try {
      const dataUrl = await captureFrame(node);
      downloadBlob(dataUrlToBlob(dataUrl), `${slug}-${String(index + 1).padStart(2, "0")}.png`);
    } catch {
      setError("Could not export that slide. Try again, or check the listing image.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    setBusy("all");
    setError(null);
    try {
      // Wait a frame so the offscreen bank is painted.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i += 1) {
        const node = bankRefs.current[i];
        if (!node) throw new Error("Missing frame");
        const dataUrl = await captureFrame(node);
        zip.file(`${slug}-${String(i + 1).padStart(2, "0")}.png`, dataUrlToBlob(dataUrl));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${slug}-instagram.zip`);
    } catch {
      setError("Could not export the full carousel. Try downloading one slide at a time.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="cr-ig-modal" role="dialog" aria-modal="true" aria-label="Export for Instagram">
      <button type="button" className="cr-ig-backdrop" aria-label="Close export" onClick={onClose} />
      <div className="cr-ig-panel">
        <header className="cr-ig-panel-head">
          <div>
            <p className="eyebrow">Instagram Feed · 1080×1350</p>
            <h2>Export For Instagram</h2>
            <p className="muted">
              {slides.length} slide{slides.length === 1 ? "" : "s"} · {label}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </header>

        {items.length === 0 && (
          <p className="notice">
            Add at least one recommendation before exporting activity cards. The intro slide will
            still download.
          </p>
        )}
        {error && <p className="error">{error}</p>}

        <div className="cr-ig-stage" ref={stageRef}>
          <div
            className="cr-ig-scale"
            style={{
              width: IG_POST_WIDTH * scale,
              height: IG_POST_HEIGHT * scale,
            }}
          >
            <div
              className="cr-ig-scale-inner"
              style={{
                width: IG_POST_WIDTH,
                height: IG_POST_HEIGHT,
                transform: `scale(${scale})`,
              }}
            >
              <SlideFrame slide={slide} frameRef={previewRef} />
            </div>
          </div>
        </div>

        <div className="cr-ig-controls">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={index === 0 || busy !== null}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            Previous
          </button>
          <p className="muted cr-ig-pager">
            {index + 1} / {slides.length}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={index >= slides.length - 1 || busy !== null}
            onClick={() => setIndex((current) => Math.min(slides.length - 1, current + 1))}
          >
            Next
          </button>
        </div>

        <div className="cr-actions cr-ig-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== null}
            onClick={downloadCurrent}
          >
            {busy === "one" ? "Downloading…" : "Download This Slide"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy !== null || slides.length === 0}
            onClick={downloadAll}
          >
            {busy === "all" ? "Zipping…" : "Download All"}
          </button>
        </div>
      </div>

      <div className="cr-ig-capture-bank" aria-hidden="true">
        {slides.map((entry, slideIndex) => (
          <SlideFrame
            key={`${entry.kind}-${slideIndex}`}
            slide={entry}
            frameRef={(node) => {
              bankRefs.current[slideIndex] = node;
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SlideFrame({
  slide,
  frameRef,
}: {
  slide: GuideExportSlide;
  frameRef: Ref<HTMLDivElement>;
}) {
  if (slide.kind === "intro") {
    return <GuideExportIntroCard slide={slide} frameRef={frameRef} />;
  }
  return <GuideExportActivityCard slide={slide} frameRef={frameRef} />;
}
