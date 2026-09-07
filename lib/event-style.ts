/** Venturo accent colours for event interests — from DESIGN_SYSTEM.md */

export const EVENT_CATEGORY_COLOUR: Record<string, string> = {
  "Adventure & Thrills": "#45A67F",
  Nightlife: "#5E589E",
  "Amusement Parks": "#FF9E6B",
  "Workshops & Education": "#7CC3E9",
  "Arts & Culture": "#DC729E",
  "Parks & Nature": "#45A67F",
  "Sports & Wellness": "#FF9E6B",
  Markets: "#971A21",
  "Sightseeing & Tours": "#7CC3E9",
  "Social Gatherings": "#DC729E",
  "Kids Play & Edutainment": "#DC729E",
  Adventure: "#45A67F",
  Music: "#5E589E",
  Workshop: "#7CC3E9",
  Family: "#DC729E",
  Sports: "#FF9E6B",
  "Food & Drink": "#F3BF4A",
  Other: "#F3BF4A",
};

export function eventCategoryColour(category: string | null | undefined) {
  if (!category) return "#F3BF4A";
  return EVENT_CATEGORY_COLOUR[category] ?? "#F3BF4A";
}
