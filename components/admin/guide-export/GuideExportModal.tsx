"use client";

import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import JSZip from "jszip";
import { captureIgSlide, downloadBlob } from "@/lib/capture-ig-slide";
import { GuideExportActivityCard } from "@/components/admin/guide-export/GuideExportActivityCard";
import { GuideExportAuthorCard } from "@/components/admin/guide-export/GuideExportAuthorCard";
import { GuideExportIntroCard } from "@/components/admin/guide-export/GuideExportIntroCard";
import {
  IG_POST_HEIGHT,
  IG_POST_WIDTH,
  buildGuideExportSlides,
  exportFileSlug,
  type GuideExportSlide,
} from "@/components/admin/guide-export/types";
import type { GuideAuthor } from "@/lib/guide-authors";
import type { GuideDraftItem } from "@/lib/guide-shared";

export function GuideExportModal({
  open,
  title,
  intro,
  items,
  author,
  onClose,
}: {
  open: boolean;
  title: string;
  intro: string;
  items: GuideDraftItem[];
  author?: GuideAuthor | null;
  onClose: () => void;
}) {
  const slides = useMemo(
    () => buildGuideExportSlides({ title, intro, items, author }),
    [title, intro, items, author],
  );
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<"one" | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyFile, setReadyFile] = useState<{ name: string; url: string } | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const bankRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.32);

  function rememberFile(blob: Blob, filename: string) {
    setReadyFile((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { name: filename, url: URL.createObjectURL(blob) };
    });
    downloadBlob(blob, filename);
  }

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setError(null);
    setBusy(null);
    setReadyFile((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    bankRefs.current = [];
  }, [open, title, intro, items, author]);

  useEffect(
    () => () => {
      setReadyFile((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return null;
      });
    },
    [],
  );

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
    slide.kind === "intro"
      ? "Intro Card"
      : slide.kind === "author"
        ? `Author · ${slide.name}`
        : `Spot ${slide.index} · ${slide.name}`;

  async function downloadCurrent() {
    const node =
      bankRefs.current[index] ??
      previewRef.current ??
      document.querySelector<HTMLElement>(".cr-ig-stage .cr-ig-frame");
    if (!node) {
      setError("Could not find that slide to export.");
      return;
    }
    setBusy("one");
    setError(null);
    try {
      const blob = await captureIgSlide(node);
      rememberFile(blob, `${slug}-${String(index + 1).padStart(2, "0")}.png`);
    } catch (err) {
      console.error(err);
      setError("Could not export that slide. Try again, or check the listing image.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    setBusy("all");
    setError(null);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i += 1) {
        const node = bankRefs.current[i];
        if (!node) throw new Error("Missing frame");
        const blob = await captureIgSlide(node);
        zip.file(`${slug}-${String(i + 1).padStart(2, "0")}.png`, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      rememberFile(blob, `${slug}-instagram.zip`);
    } catch (err) {
      console.error(err);
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
            {busy === "one" ? "Preparing…" : "Download This Slide"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy !== null || slides.length === 0}
            onClick={downloadAll}
          >
            {busy === "all" ? "Zipping…" : "Download All"}
          </button>
          {readyFile ? (
            <a className="btn btn-secondary" href={readyFile.url} download={readyFile.name}>
              Save {readyFile.name}
            </a>
          ) : null}
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
  if (slide.kind === "author") {
    return <GuideExportAuthorCard slide={slide} frameRef={frameRef} />;
  }
  return <GuideExportActivityCard slide={slide} frameRef={frameRef} />;
}
