"use client";

import type { ProfileCatalog } from "@/lib/profile-shared";

export function EnergySpectrum({
  scales,
  energyLow,
  energyHigh,
  onPick,
}: {
  scales: ProfileCatalog["scales"];
  energyLow: string;
  energyHigh: string;
  onPick: (rank: number) => void;
}) {
  const low = energyLow ? Number(energyLow) : null;
  const high = energyHigh ? Number(energyHigh) : null;
  const lowTitle = scales.find((scale) => scale.rank === low)?.title;
  const highTitle = scales.find((scale) => scale.rank === high)?.title;

  return (
    <div className="energy-spectrum" role="group" aria-label="Activity level range">
      <div className="energy-spectrum-track" aria-hidden>
        <span
          className="energy-spectrum-fill"
          style={
            low != null && high != null
              ? {
                  left: `${((low - 1) / Math.max(scales.length - 1, 1)) * 100}%`,
                  width: `${((high - low) / Math.max(scales.length - 1, 1)) * 100}%`,
                }
              : undefined
          }
        />
      </div>
      <div className="energy-spectrum-stops">
        {scales.map((scale) => {
          const inRange =
            low != null && high != null && scale.rank >= low && scale.rank <= high;
          const isEnd = scale.rank === low || scale.rank === high;
          return (
            <button
              key={scale.rank}
              type="button"
              data-rank={scale.rank}
              className={`energy-stop${inRange ? " in-range" : ""}${isEnd ? " end" : ""}`}
              onClick={() => onPick(scale.rank)}
              aria-pressed={inRange}
            >
              <span className="energy-bars" aria-hidden>
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="energy-stop-label">{scale.title}</span>
              {scale.subtitle ? (
                <span className="energy-stop-sub">{scale.subtitle}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="muted energy-spectrum-hint">
        {low != null && high != null
          ? low === high
            ? `Selected: ${lowTitle}. Tap another card to stretch your range.`
            : `Selected: ${lowTitle} through ${highTitle}.`
          : "Tap a card to start. Tap another to set your range from calmer to more intense."}
      </p>
    </div>
  );
}
