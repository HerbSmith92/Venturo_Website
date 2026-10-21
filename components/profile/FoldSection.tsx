"use client";

import { useState } from "react";

export function FoldSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className={open ? "cr-step is-open" : "cr-step"}>
      <h2>
        <button
          type="button"
          className="cr-step-toggle"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <em>{title}</em>
          <i className="cr-step-caret" aria-hidden="true" />
        </button>
      </h2>
      {children}
    </section>
  );
}
