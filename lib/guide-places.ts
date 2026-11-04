import type { GuidePlace } from "@/lib/guide-shared";

const PROVINCE_ORDER = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

export function joinGuideLabels(labels: string[]) {
  const clean = labels.map((item) => item.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "";
  return `${clean.slice(0, -1).join(", ")} & ${clean[clean.length - 1]}`;
}

export function parseUuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function groupGuidePlaces(places: GuidePlace[]) {
  const groups = new Map<string, GuidePlace[]>();
  for (const place of places) {
    const region = place.region.trim() || "Other";
    const list = groups.get(region) ?? [];
    list.push(place);
    groups.set(region, list);
  }
  const known = PROVINCE_ORDER.flatMap((region) => {
    const list = groups.get(region);
    if (!list?.length) return [];
    return [{ region, places: list }];
  });
  const extra = [...groups.entries()]
    .filter(([region]) => !PROVINCE_ORDER.includes(region))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([region, list]) => ({ region, places: list }));
  return [...known, ...extra];
}
