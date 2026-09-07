"use client";

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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseLocal(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return { year: 0, month: 0, day: 0, hour: -1, minute: -1 };
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function daysInMonth(year: number, month: number) {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function weekdayName(year: number, month: number, day: number) {
  if (!year || !month || !day) return "Pick a date";
  const date = new Date(Date.UTC(year, month - 1, day, 10));
  return WEEKDAYS[date.getUTCDay()] ?? "Pick a date";
}

const thisYear = new Date().getFullYear();
const YEARS = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2, thisYear + 3];
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

export function StudioDateTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const parts = parseLocal(value);
  const maxDay = daysInMonth(parts.year, parts.month);
  const dayOptions = Array.from({ length: maxDay }, (_, i) => i + 1);
  const minuteOptions =
    parts.minute >= 0 && !MINUTES.includes(pad(parts.minute))
      ? [...MINUTES, pad(parts.minute)].sort()
      : MINUTES;

  function setPart(
    key: "year" | "month" | "day" | "hour" | "minute",
    raw: string,
  ) {
    const next = { ...parts };
    next[key] = Number(raw);
    if (next.year && next.month) {
      const cap = daysInMonth(next.year, next.month);
      if (next.day > cap) next.day = cap;
    }
    if (!next.year || !next.month || !next.day || next.hour < 0 || next.minute < 0) {
      onChange("");
      return;
    }
    onChange(
      `${next.year}-${pad(next.month)}-${pad(next.day)}T${pad(next.hour)}:${pad(next.minute)}`,
    );
  }

  const weekday = weekdayName(parts.year, parts.month, parts.day);
  const monthName = parts.month ? MONTHS[parts.month - 1] : "Month";
  const timeLabel =
    parts.hour >= 0 && parts.minute >= 0 ? `${pad(parts.hour)}:${pad(parts.minute)}` : "—:—";

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
      <div className="studio-when-picks">
        <label className="field">
          <span>Day</span>
          <select value={parts.day || ""} onChange={(event) => setPart("day", event.target.value)}>
            <option value="">Day</option>
            {dayOptions.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Month</span>
          <select
            value={parts.month || ""}
            onChange={(event) => setPart("month", event.target.value)}
          >
            <option value="">Month</option>
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Year</span>
          <select
            value={parts.year || ""}
            onChange={(event) => setPart("year", event.target.value)}
          >
            <option value="">Year</option>
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Hour</span>
          <select
            value={parts.hour >= 0 ? pad(parts.hour) : ""}
            onChange={(event) => setPart("hour", event.target.value)}
          >
            <option value="">Hour</option>
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Minute</span>
          <select
            value={parts.minute >= 0 ? pad(parts.minute) : ""}
            onChange={(event) => setPart("minute", event.target.value)}
          >
            <option value="">Min</option>
            {minuteOptions.map((minute) => (
              <option key={minute} value={minute}>
                {minute}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
