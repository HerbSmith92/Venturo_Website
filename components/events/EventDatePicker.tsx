"use client";

import { useEffect, useRef } from "react";

type Occurrence = { startsAt: string; endsAt: string };

function parts(iso: string, timezone: string) {
  const list = new Intl.DateTimeFormat("en-ZA", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    list.find((item) => item.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    day: get("day"),
    month: get("month"),
    year: get("year"),
    time: `${get("hour").trim()}:${get("minute").trim()}`,
  };
}

function windowLabel(startsAt: string, endsAt: string, timezone: string) {
  const start = parts(startsAt, timezone);
  const end = endsAt ? parts(endsAt, timezone) : null;
  const day = `${start.day} ${start.month} ${start.year}`;
  if (!end) return `${day} · ${start.time}`;
  const endDay = `${end.day} ${end.month} ${end.year}`;
  if (day === endDay) return `${day} · ${start.time}–${end.time}`;
  return `${day} ${start.time} – ${endDay} ${end.time}`;
}

function clockLabel(startsAt: string, endsAt: string, timezone: string) {
  const start = parts(startsAt, timezone);
  const end = endsAt ? parts(endsAt, timezone) : null;
  if (!end) return start.time;
  const sameDay =
    start.day === end.day && start.month === end.month && start.year === end.year;
  return sameDay ? `${start.time}–${end.time}` : `${start.time} – ${end.time}`;
}

export function EventDatePicker({
  slug,
  timezone,
  occurrences,
  selectedStartsAt,
}: {
  slug: string;
  timezone: string;
  occurrences: Occurrence[];
  selectedStartsAt: string;
}) {
  const railRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    const current = rail?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!rail || !current) return;
    const left = current.offsetLeft - (rail.clientWidth - current.clientWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left) });
  }, [selectedStartsAt]);

  const clocks = occurrences.map((item) => clockLabel(item.startsAt, item.endsAt, timezone));
  const sharedTime = clocks.every((time) => time === clocks[0]) ? clocks[0] : "";

  return (
    <div className="event-date-picker">
      <p className="eyebrow">Choose a date</p>
      {sharedTime ? <p className="event-date-time">Every date is {sharedTime}.</p> : null}
      <ul className="event-date-rail" ref={railRef}>
        {occurrences.map((occurrence, index) => {
          const chip = parts(occurrence.startsAt, timezone);
          const current = occurrence.startsAt === selectedStartsAt;
          return (
            <li key={occurrence.startsAt}>
              <a
                href={`/events/${slug}?on=${encodeURIComponent(occurrence.startsAt)}#tickets`}
                aria-current={current ? "true" : undefined}
                aria-label={windowLabel(occurrence.startsAt, occurrence.endsAt, timezone)}
              >
                <span className="event-date-dow">{chip.weekday}</span>
                <span className="event-date-day">{chip.day}</span>
                <span className="event-date-month">
                  {chip.month} {chip.year}
                </span>
                {sharedTime ? null : <span className="event-date-clock">{clocks[index]}</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
