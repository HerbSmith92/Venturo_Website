export type IndoorOutdoorSetting = "indoor" | "outdoor" | "both";

export const SETTING_OPTIONS: { value: IndoorOutdoorSetting; label: string }[] = [
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
  { value: "both", label: "Indoor & Outdoor" },
];

export function parseSetting(value: string | null | undefined): IndoorOutdoorSetting | null {
  if (value === "indoor" || value === "outdoor" || value === "both") return value;
  return null;
}

export function settingLabel(value: IndoorOutdoorSetting | null | undefined): string | null {
  if (!value) return null;
  return SETTING_OPTIONS.find((option) => option.value === value)?.label ?? null;
}

/** Spec: Indoor only excludes both; multi-select is OR; specific selection excludes null. */
export function settingMatches(
  record: IndoorOutdoorSetting | null | undefined,
  selected: IndoorOutdoorSetting[],
): boolean {
  if (!selected.length) return true;
  if (!record) return false;
  return selected.includes(record);
}
