"use client";

export function PrintPosterButton() {
  return (
    <button className="btn btn-primary" type="button" onClick={() => window.print()}>
      Print
    </button>
  );
}
