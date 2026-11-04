"use client";

import { useState, type ReactNode } from "react";

export function GuideInfoBubble({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="guide-desk-info">
      <summary aria-label={label}>i</summary>
      <div className="guide-desk-info-panel">{children}</div>
    </details>
  );
}

export function GuideFieldLabel({
  children,
  info,
  infoLabel,
}: {
  children: ReactNode;
  info?: ReactNode;
  infoLabel?: string;
}) {
  return (
    <span className="guide-desk-label">
      {children}
      {info ? <GuideInfoBubble label={infoLabel || "More about this"}>{info}</GuideInfoBubble> : null}
    </span>
  );
}

export function GuideFold({
  title,
  info,
  infoLabel,
  summary,
  children,
}: {
  title: string;
  info?: ReactNode;
  infoLabel?: string;
  summary?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className={open ? "guide-desk-fold is-open" : "guide-desk-fold"}>
      <header>
        <button
          type="button"
          className="guide-desk-fold-title"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <em>{title}</em>
        </button>
        {info ? <GuideInfoBubble label={infoLabel || title}>{info}</GuideInfoBubble> : null}
        <button
          type="button"
          className="guide-desk-fold-toggle"
          aria-expanded={open}
          aria-label={open ? `Hide ${title}` : `Show ${title}`}
          onClick={() => setOpen((current) => !current)}
        >
          {!open && summary ? <small>{summary}</small> : null}
          <i className="cr-step-caret" aria-hidden="true" />
        </button>
      </header>
      {open ? <div className="guide-desk-fold-body">{children}</div> : null}
    </section>
  );
}
