import { johannesburgDay, shiftDay } from "@/lib/portal-home";

export const ANALYTICS_RANGE_KEYS = ["7d", "30d", "90d", "365d", "custom"] as const;
export type AnalyticsRangeKey = (typeof ANALYTICS_RANGE_KEYS)[number];

export type AnalyticsRange = {
  key: AnalyticsRangeKey;
  from: string;
  to: string;
  label: string;
};

const LABELS: Record<Exclude<AnalyticsRangeKey, "custom">, string> = {
  "7d": "Last 7 days",
  "30d": "Month",
  "90d": "3 months",
  "365d": "Year",
};

const DAYS: Record<Exclude<AnalyticsRangeKey, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 366;

function isRangeKey(value: string | undefined): value is AnalyticsRangeKey {
  return ANALYTICS_RANGE_KEYS.includes(value as AnalyticsRangeKey);
}

function validDay(value: string | undefined) {
  if (!value || !DATE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((b - a) / 86_400_000) + 1;
}

export function resolveAnalyticsRange(input: { range?: string; from?: string; to?: string }): AnalyticsRange {
  const today = johannesburgDay();
  const key: AnalyticsRangeKey = isRangeKey(input.range) ? input.range : "7d";

  if (key === "custom") {
    let from = validDay(input.from) ?? shiftDay(today, -6);
    let to = validDay(input.to) ?? today;
    if (from > to) {
      const swap = from;
      from = to;
      to = swap;
    }
    if (to > today) to = today;
    if (from > today) from = today;
    if (daysBetween(from, to) > MAX_CUSTOM_DAYS) {
      from = shiftDay(to, -(MAX_CUSTOM_DAYS - 1));
    }
    return { key, from, to, label: `${from} – ${to}` };
  }

  const span = DAYS[key];
  return {
    key,
    from: shiftDay(today, -(span - 1)),
    to: today,
    label: LABELS[key],
  };
}
