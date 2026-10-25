"use client";

import type { AreaGroup } from "@/lib/area-groups";
import { formatCount } from "@/lib/overview/metrics";
import { useState } from "react";

function warn(members: number, behind: number) {
  return members > 0 && behind > 0 ? "is-warn" : undefined;
}

export function AreaGroups({ groups }: { groups: AreaGroup[] }) {
  const [closed, setClosed] = useState<string[]>([]);

  function toggle(id: string) {
    setClosed((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <>
      {groups.map((group) => {
        const open = !closed.includes(group.id);
        return (
          <tbody key={group.id}>
            <tr className={["is-group", warn(group.members, group.behind)].filter(Boolean).join(" ")}>
              <td data-label="Area">
                <button
                  type="button"
                  className="ops-fold"
                  aria-expanded={open}
                  aria-label={open ? `Minimise ${group.title}` : `Show ${group.title}`}
                  onClick={() => toggle(group.id)}
                >
                  <span>{open ? "Minimise" : "Show"}</span>
                  {group.title}
                </button>
              </td>
              <td data-label="Members">{formatCount(group.members)}</td>
              <td data-label="Live listings">{formatCount(group.listings)}</td>
              <td data-label="Member rank">{formatCount(group.memberRank)}</td>
              <td data-label="Listing rank">{formatCount(group.listingRank)}</td>
              <td data-label="Gap">{formatCount(group.behind)}</td>
            </tr>
            {open
              ? group.places.map((place) => (
                  <tr key={place.id} className={["is-place", warn(place.members, place.behind)].filter(Boolean).join(" ")}>
                    <td data-label="Area">{place.title}</td>
                    <td data-label="Members">{formatCount(place.members)}</td>
                    <td data-label="Live listings">{formatCount(place.listings)}</td>
                    <td data-label="Member rank">{formatCount(place.memberRank)}</td>
                    <td data-label="Listing rank">{formatCount(place.listingRank)}</td>
                    <td data-label="Gap">{formatCount(place.behind)}</td>
                  </tr>
                ))
              : null}
          </tbody>
        );
      })}
    </>
  );
}
