export type CategoryId =
  | "adventure"
  | "thrills"
  | "family"
  | "romance"
  | "team"
  | "nightlife"
  | "workshop"
  | "markets"
  | "digital"
  | "third-party";

export const CATEGORIES: {
  id: CategoryId | "all";
  label: string;
  colour: string;
  ink: string;
}[] = [
  { id: "all", label: "All", colour: "#2A2D35", ink: "#EBEBF3" },
  { id: "team", label: "Team", colour: "#F3BF4A", ink: "#2A2D35" },
  { id: "thrills", label: "Thrills", colour: "#FF9E6B", ink: "#2A2D35" },
  { id: "adventure", label: "Adventure", colour: "#45A67F", ink: "#EBEBF3" },
  { id: "romance", label: "Romance", colour: "#D54732", ink: "#EBEBF3" },
  { id: "family", label: "Family", colour: "#DC729E", ink: "#2A2D35" },
  { id: "workshop", label: "Workshops & Education", colour: "#FF2EFF", ink: "#2A2D35" },
  { id: "markets", label: "Markets", colour: "#971A21", ink: "#EBEBF3" },
  { id: "digital", label: "Digital", colour: "#7CC3E9", ink: "#2A2D35" },
  { id: "nightlife", label: "Nightlife", colour: "#5E589E", ink: "#EBEBF3" },
  { id: "third-party", label: "Third Party", colour: "#14001A", ink: "#EBEBF3" },
];

export const PUBLIC_CATEGORIES = CATEGORIES.filter(
  (category) => category.id !== "digital" && category.id !== "third-party",
);

const CATEGORY_IDS = new Set(CATEGORIES.map((item) => item.id));

export function isCategoryId(value: string): value is CategoryId {
  return CATEGORY_IDS.has(value as CategoryId);
}

export function formatFromPrice(rand: number | null | undefined) {
  if (rand == null) return "Price to follow";
  if (rand === 0) return "Free";
  return `From R ${rand.toFixed(2)}`;
}

export function categoryLabel(id: CategoryId) {
  return CATEGORIES.find((item) => item.id === id)?.label ?? id;
}

export function categoryColour(id: CategoryId) {
  return CATEGORIES.find((item) => item.id === id)?.colour ?? "#FF9E6B";
}

export function asCategoryId(value: string | null | undefined): CategoryId | null {
  if (!value || !isCategoryId(value)) return null;
  return value;
}
