"use client";

import type { ReactNode } from "react";
import { GuideFold } from "@/components/admin/guide-desk/GuideFold";

export function GuideSuggestedTitles({
  titles,
  activeTitle,
  info,
  onPick,
}: {
  titles: readonly string[];
  activeTitle: string;
  info: ReactNode;
  onPick: (title: string) => void;
}) {
  const picked = titles.includes(activeTitle as (typeof titles)[number]) ? activeTitle : "";
  return (
    <GuideFold title="Suggested titles" info={info} infoLabel="How matching works" summary={picked || "Pick a title"}>
      <div className="cr-chip-grid">
        {titles.map((title) => (
          <button
            key={title}
            type="button"
            className={activeTitle === title ? "cr-tag active" : "cr-tag"}
            onClick={() => onPick(title)}
          >
            {title}
          </button>
        ))}
      </div>
    </GuideFold>
  );
}
