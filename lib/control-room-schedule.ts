/** Control Room schedules default to Africa/Johannesburg (SAST, UTC+2, no DST). */

export const CONTROL_ROOM_TIMEZONE = "Africa/Johannesburg";
export const CONTROL_ROOM_TIMEZONE_LABEL = "Africa/Johannesburg (SAST)";

export type ScheduleStatus = "draft" | "scheduled" | "active" | "expired" | "inactive";

export type ScheduleInput = {
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** When false, treat as draft even if dates would otherwise activate. */
  isPublished?: boolean;
  now?: Date;
};

/** Parse an HTML datetime-local value as SAST wall time → ISO UTC. */
export function sastLocalToIso(local: string | null | undefined): string | null {
  const value = String(local ?? "").trim();
  if (!value) return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const utc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h) - 2,
    Number(mi),
    Number(s ?? 0),
  );
  return new Date(utc).toISOString();
}

/** Format an ISO timestamp as SAST for datetime-local inputs. */
export function isoToSastLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: CONTROL_ROOM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatSastDisplay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: CONTROL_ROOM_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function scheduleStatus(input: ScheduleInput): ScheduleStatus {
  if (input.isPublished === false) return "draft";
  if (!input.isActive) return "inactive";
  const now = (input.now ?? new Date()).getTime();
  const start = input.startsAt ? new Date(input.startsAt).getTime() : null;
  const end = input.endsAt ? new Date(input.endsAt).getTime() : null;
  if (end !== null && !Number.isNaN(end) && end < now) return "expired";
  if (start !== null && !Number.isNaN(start) && start > now) return "scheduled";
  return "active";
}

export function scheduleStatusLabel(status: ScheduleStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "inactive":
      return "Inactive";
  }
}
