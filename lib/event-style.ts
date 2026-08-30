/** Venturo accent colours for event categories — from DESIGN_SYSTEM.md */

export const EVENT_CATEGORY_COLOUR: Record<string, string> = {
  Adventure: "#45A67F",
  Music: "#5E589E",
  "Social Gathering": "#DC729E",
  Workshop: "#7CC3E9",
  Markets: "#971A21",
  Nightlife: "#5E589E",
  Family: "#DC729E",
  Sports: "#FF9E6B",
  "Food & Drink": "#F3BF4A",
  Other: "#F3BF4A",
};

export function eventCategoryColour(category: string | null | undefined) {
  if (!category) return "#F3BF4A";
  return EVENT_CATEGORY_COLOUR[category] ?? "#F3BF4A";
}
