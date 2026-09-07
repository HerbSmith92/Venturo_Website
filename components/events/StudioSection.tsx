"use client";

import { useState } from "react";

export function StudioSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`studio-card studio-section${open ? " is-open" : ""}`}>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {title}
          <span className="studio-section-toggle" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </h2>
      {open ? <div className="studio-section-body">{children}</div> : null}
    </section>
  );
}
