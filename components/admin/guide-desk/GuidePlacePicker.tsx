"use client";

import { GuideFold } from "@/components/admin/guide-desk/GuideFold";
import { groupGuidePlaces, joinGuideLabels } from "@/lib/guide-places";
import type { GuidePlace } from "@/lib/guide-shared";

export function GuidePlacePicker({
  places,
  selectedIds,
  onChange,
}: {
  places: GuidePlace[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const groups = groupGuidePlaces(places);
  const anywhere = selectedIds.length === 0;
  const summary = anywhere
    ? "Anywhere"
    : joinGuideLabels(places.filter((place) => selectedIds.includes(place.id)).map((place) => place.name)) ||
      "Anywhere";

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  return (
    <GuideFold
      title="In and around"
      info="Tick several areas, grouped by province. Leave them empty for anywhere. Matching uses the listing or event area name."
      infoLabel="How In and around works"
      summary={summary}
    >
      <div className="guide-desk-chips">
        <button
          type="button"
          className={anywhere ? "is-on" : undefined}
          aria-pressed={anywhere}
          onClick={() => onChange([])}
        >
          Anywhere
        </button>
      </div>
      {groups.map((group) => (
        <div key={group.region}>
          <p className="cr-about-label">{group.region}</p>
          <div className="guide-desk-chips">
            {group.places.map((place) => {
              const active = selectedIds.includes(place.id);
              return (
                <button
                  key={place.id}
                  type="button"
                  className={active ? "is-on" : undefined}
                  aria-pressed={active}
                  onClick={() => toggle(place.id)}
                >
                  {active ? <i aria-hidden="true">✓</i> : null}
                  {place.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </GuideFold>
  );
}
