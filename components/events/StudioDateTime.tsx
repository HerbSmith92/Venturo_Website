"use client";

import { useEffect, useRef, useState } from "react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_HEADS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

type DayCell = {
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayDate() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function emptyTime(): Pick<Parts, "hour" | "minute"> {
  return { hour: -1, minute: -1 };
}

function parseLocal(value: string): Parts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function initialParts(value: string): Parts {
  return parseLocal(value) ?? { ...todayDate(), ...emptyTime() };
}

function formatLocal(parts: Parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function isComplete(parts: Parts) {
  return Boolean(parts.year && parts.month && parts.day && parts.hour >= 0 && parts.minute >= 0);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function weekdayName(year: number, month: number, day: number) {
  if (!year || !month || !day) return "Pick a date";
  const date = new Date(year, month - 1, day);
  return WEEKDAYS[date.getDay()] ?? "Pick a date";
}

function sameDay(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function calendarCells(year: number, month: number): DayCell[] {
  const first = new Date(year, month - 1, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const count = daysInMonth(year, month);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const prevCount = daysInMonth(prev.year, prev.month);
  const cells: DayCell[] = [];
  for (let i = startOffset - 1; i >= 0; i -= 1) {
    cells.push({ year: prev.year, month: prev.month, day: prevCount - i, inMonth: false });
  }
  for (let day = 1; day <= count; day += 1) {
    cells.push({ year, month, day, inMonth: true });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ year: next.year, month: next.month, day: nextDay, inMonth: false });
    nextDay += 1;
  }
  return cells;
}

function timeDraftFromParts(parts: Parts) {
  if (parts.hour < 0 || parts.minute < 0) return "";
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

function readTypedTime(raw: string): { draft: string; hour: number; minute: number } {
  if (raw.includes(":")) {
    const [hourRaw, minuteRaw = ""] = raw.split(":");
    const hourDigits = hourRaw.replace(/\D/g, "").slice(0, 2);
    const minuteDigits = minuteRaw.replace(/\D/g, "").slice(0, 2);
    const draft = `${hourDigits}:${minuteDigits}`;
    const hour = Number(hourDigits);
    const minute = Number(minuteDigits);
    const valid = hourDigits.length > 0 && minuteDigits.length === 2 && hour <= 23 && minute <= 59;
    return { draft, hour: valid ? hour : -1, minute: valid ? minute : -1 };
  }
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return { draft: digits, hour: -1, minute: -1 };
  const draft = `${digits.slice(0, 2)}:${digits.slice(2)}`;
  if (digits.length < 4) return { draft, hour: -1, minute: -1 };
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2));
  const valid = hour <= 23 && minute <= 59;
  return { draft, hour: valid ? hour : -1, minute: valid ? minute : -1 };
}

export function StudioDateTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [parts, setParts] = useState(() => initialParts(value));
  const [timeDraft, setTimeDraft] = useState(() => timeDraftFromParts(initialParts(value)));
  const [view, setView] = useState(() => {
    const start = initialParts(value);
    return { year: start.year, month: start.month };
  });
  const emitted = useRef(value);
  const today = todayDate();

  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const next = initialParts(value);
    setParts(next);
    setTimeDraft(timeDraftFromParts(next));
    setView({ year: next.year, month: next.month });
  }, [value]);

  function commit(next: Parts) {
    setParts(next);
    if (!isComplete(next)) return;
    const formatted = formatLocal(next);
    emitted.current = formatted;
    onChange(formatted);
  }

  function pickDay(cell: DayCell) {
    setView({ year: cell.year, month: cell.month });
    commit({ ...parts, year: cell.year, month: cell.month, day: cell.day });
  }

  function pickToday() {
    setView(today);
    commit({ ...parts, ...today });
  }

  function onTimeInput(raw: string) {
    const next = readTypedTime(raw);
    setTimeDraft(next.draft);
    commit({ ...parts, hour: next.hour, minute: next.minute });
  }

  function padTimeDraft() {
    if (parts.hour < 0 || parts.minute < 0) return;
    setTimeDraft(`${pad(parts.hour)}:${pad(parts.minute)}`);
  }

  const weekday = weekdayName(parts.year, parts.month, parts.day);
  const monthName = parts.month ? MONTHS[parts.month - 1] : "Month";
  const timeLabel =
    parts.hour >= 0 && parts.minute >= 0 ? `${pad(parts.hour)}:${pad(parts.minute)}` : "—:—";
  const cells = calendarCells(view.year, view.month);

  return (
    <div className="studio-when">
      <span className="studio-when-label">{label}</span>
      <div className="studio-when-face">
        <strong className="studio-when-date">{parts.day || "—"}</strong>
        <div>
          <p className="studio-when-weekday">{weekday}</p>
          <p className="studio-when-month">
            {monthName}
            {parts.year ? ` ${parts.year}` : ""}
          </p>
          <p className="studio-when-clock">{timeLabel}</p>
        </div>
      </div>
      <div className="studio-cal">
        <div className="studio-cal-head">
          <strong>
            {MONTHS[view.month - 1]} {view.year}
          </strong>
          <div className="studio-cal-nav">
            <button type="button" className="studio-cal-today" onClick={pickToday}>
              Today
            </button>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setView((current) => shiftMonth(current.year, current.month, -1))}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView((current) => shiftMonth(current.year, current.month, 1))}
            >
              ›
            </button>
          </div>
        </div>
        <div className="studio-cal-grid" role="grid" aria-label={label}>
          {WEEKDAY_HEADS.map((name) => (
            <span key={name} className="studio-cal-dow">
              {name}
            </span>
          ))}
          {cells.map((cell) => {
            const selected = sameDay(cell, parts);
            const isToday = sameDay(cell, today);
            return (
              <button
                key={`${cell.year}-${cell.month}-${cell.day}`}
                type="button"
                className={`studio-cal-day${cell.inMonth ? "" : " is-out"}${isToday ? " is-today" : ""}${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                aria-label={`${cell.day} ${MONTHS[cell.month - 1]} ${cell.year}`}
                onClick={() => pickDay(cell)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>
      <label className="field studio-when-time">
        <span>Time</span>
        <input
          value={timeDraft}
          onChange={(event) => onTimeInput(event.target.value)}
          onBlur={padTimeDraft}
          inputMode="numeric"
          autoComplete="off"
          placeholder="00:00"
          aria-label={`${label} time, 24-hour`}
          maxLength={5}
        />
      </label>
    </div>
  );
}
