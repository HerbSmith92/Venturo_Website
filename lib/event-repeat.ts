import type { RepeatEvery, RepeatOrdinal, RepeatWeekday } from "@/lib/event-types";

export type { RepeatEvery, RepeatOrdinal, RepeatWeekday };

const SAST_MS = 2 * 60 * 60 * 1000;

export const REPEAT_ORDINALS: { id: RepeatOrdinal; label: string }[] = [
  { id: "first", label: "First" },
  { id: "second", label: "Second" },
  { id: "third", label: "Third" },
  { id: "fourth", label: "Fourth" },
  { id: "last", label: "Last" },
];

export const REPEAT_WEEKDAYS: { id: RepeatWeekday; label: string; js: number }[] = [
  { id: "mon", label: "Monday", js: 1 },
  { id: "tue", label: "Tuesday", js: 2 },
  { id: "wed", label: "Wednesday", js: 3 },
  { id: "thu", label: "Thursday", js: 4 },
  { id: "fri", label: "Friday", js: 5 },
  { id: "sat", label: "Saturday", js: 6 },
  { id: "sun", label: "Sunday", js: 0 },
];

const WEEKDAY_FROM_JS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function repeatCode(ordinal: RepeatOrdinal, weekday: RepeatWeekday): RepeatEvery {
  return `${ordinal}-${weekday}`;
}

export function parseRepeat(value: string | null | undefined):
  | { kind: "week" }
  | { kind: "month" }
  | { kind: "weekday"; ordinal: RepeatOrdinal; weekday: RepeatWeekday }
  | null {
  if (value === "week" || value === "month") return { kind: value };
  const match = value?.match(/^(first|second|third|fourth|last)-(mon|tue|wed|thu|fri|sat|sun)$/);
  if (!match) return null;
  return {
    kind: "weekday",
    ordinal: match[1] as RepeatOrdinal,
    weekday: match[2] as RepeatWeekday,
  };
}

export function weekdayFromDateInput(value: string): RepeatWeekday {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const day = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()
    : new Date(Date.now() + SAST_MS).getUTCDay();
  return WEEKDAY_FROM_JS[day] ?? "thu";
}

export function repeatPhrase(every: RepeatEvery | null | undefined) {
  const rule = parseRepeat(every);
  if (!rule) return "";
  if (rule.kind === "week") return "Weekly";
  if (rule.kind === "month") return "Monthly";
  const day = REPEAT_WEEKDAYS.find((item) => item.id === rule.weekday)?.label ?? "";
  const which = REPEAT_ORDINALS.find((item) => item.id === rule.ordinal)?.label.toLowerCase() ?? "";
  return `The ${which} ${day} of each month`;
}

type Wall = { year: number; month: number; day: number; hour: number; minute: number };

function toWall(date: Date): Wall {
  const shifted = new Date(date.getTime() + SAST_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function fromWall(wall: Wall) {
  return new Date(Date.UTC(wall.year, wall.month, wall.day, wall.hour, wall.minute) - SAST_MS);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function nthWeekdayDay(year: number, month: number, ordinal: RepeatOrdinal, weekday: number) {
  if (ordinal === "last") {
    const lastDay = daysInMonth(year, month);
    const lastWeekday = new Date(Date.UTC(year, month, lastDay)).getUTCDay();
    return lastDay - ((lastWeekday - weekday + 7) % 7);
  }
  const index = { first: 1, second: 2, third: 3, fourth: 4 }[ordinal];
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (index - 1) * 7;
  return day <= daysInMonth(year, month) ? day : null;
}

function addMonths(wall: Wall, count: number): Wall {
  const index = wall.month + count;
  const year = wall.year + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  return { ...wall, year, month, day: Math.min(wall.day, daysInMonth(year, month)) };
}

function weekdayJs(code: RepeatWeekday) {
  return REPEAT_WEEKDAYS.find((item) => item.id === code)?.js ?? 4;
}

function step(cursor: Date, every: RepeatEvery, hour: number, minute: number) {
  const rule = parseRepeat(every);
  if (!rule || rule.kind === "week") return new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  const wall = toWall(cursor);
  if (rule.kind === "month") return fromWall(addMonths({ ...wall, hour, minute }, 1));
  const js = weekdayJs(rule.weekday);
  for (let i = 1; i <= 18; i += 1) {
    const month = addMonths({ ...wall, day: 1, hour, minute }, i);
    const day = nthWeekdayDay(month.year, month.month, rule.ordinal, js);
    if (day) return fromWall({ ...month, day });
  }
  return new Date(cursor.getTime() + 32 * 24 * 60 * 60 * 1000);
}

function firstAfter(start: Date, every: RepeatEvery, hour: number, minute: number) {
  const rule = parseRepeat(every);
  if (!rule || rule.kind === "week") return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const wall = toWall(start);
  if (rule.kind === "month") return fromWall(addMonths({ ...wall, hour, minute }, 1));
  const js = weekdayJs(rule.weekday);
  for (let i = 0; i <= 18; i += 1) {
    const month = addMonths({ ...wall, day: 1, hour, minute }, i);
    const day = nthWeekdayDay(month.year, month.month, rule.ordinal, js);
    if (!day) continue;
    const occ = fromWall({ ...month, day });
    if (occ.getTime() > start.getTime()) return occ;
  }
  return new Date(start.getTime() + 32 * 24 * 60 * 60 * 1000);
}

/** The next date that has not ended, within the repeat window. */
export function nextOccurrence(
  startsAt: string,
  endsAt: string,
  every: RepeatEvery | null | undefined,
  until: string | null | undefined,
  now = new Date(),
): { startsAt: string; endsAt: string } | null {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const duration = Math.max(0, end.getTime() - start.getTime());
  if (!every || !parseRepeat(every)) {
    return end.getTime() >= now.getTime() ? { startsAt, endsAt } : null;
  }
  const untilTime = until ? new Date(until).getTime() : start.getTime();
  if (Number.isNaN(untilTime)) return null;
  const wall = toWall(start);
  let cursor = start;
  let onPattern = false;
  for (let i = 0; i < 400; i += 1) {
    if (cursor.getTime() > untilTime) return null;
    const occEnd = cursor.getTime() + duration;
    if (occEnd >= now.getTime()) {
      return { startsAt: cursor.toISOString(), endsAt: new Date(occEnd).toISOString() };
    }
    cursor = onPattern
      ? step(cursor, every, wall.hour, wall.minute)
      : firstAfter(start, every, wall.hour, wall.minute);
    onPattern = true;
  }
  return null;
}
