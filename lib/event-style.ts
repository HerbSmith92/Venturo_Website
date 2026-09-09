/** Venturo accent colours for event interests — from DESIGN_SYSTEM.md */

import { COLORS } from "@/lib/brand";

export const EVENT_CATEGORY_COLOUR: Record<string, string> = {
  "Adventure & Thrills": COLORS.jade,
  Nightlife: COLORS.velvet,
  "Amusement Parks": COLORS.orange,
  "Workshops & Education": COLORS.sapphire,
  "Arts & Culture": COLORS.blush,
  "Parks & Nature": COLORS.jade,
  "Sports & Wellness": COLORS.orange,
  Markets: COLORS.maroon,
  "Sightseeing & Tours": COLORS.sapphire,
  "Social Gatherings": COLORS.blush,
  "Kids Play & Edutainment": COLORS.blush,
  Adventure: COLORS.jade,
  Music: COLORS.velvet,
  Workshop: COLORS.sapphire,
  Family: COLORS.blush,
  Sports: COLORS.orange,
  "Food & Drink": COLORS.canary,
  Other: COLORS.canary,
};

export function eventCategoryColour(category: string | null | undefined) {
  if (!category) return COLORS.canary;
  return EVENT_CATEGORY_COLOUR[category] ?? COLORS.canary;
}

/** Night Sky on bright chips, Snow Drift on dark chips. */
export function eventCategoryChipInk(fill: string) {
  const hex = fill.replace("#", "");
  if (hex.length !== 6) return COLORS.nightSky;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma < 125 ? COLORS.snowDrift : COLORS.nightSky;
}
