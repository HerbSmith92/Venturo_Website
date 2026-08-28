export const LISTING_STATUSES = ["draft", "review", "approved", "archived"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_ACTIONS = ["approve", "review", "draft", "archive", "feature"] as const;
export type ListingAction = (typeof LISTING_ACTIONS)[number];

export function isListingStatus(value: string): value is ListingStatus {
  return LISTING_STATUSES.includes(value as ListingStatus);
}

export function isListingAction(value: string): value is ListingAction {
  return LISTING_ACTIONS.includes(value as ListingAction);
}

export function listingStatusLabel(status: string) {
  if (status === "approved") return "Live";
  if (status === "review") return "In Review";
  if (status === "archived") return "Archived";
  return "Draft";
}

export function formatRand(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return `R ${n.toFixed(2)}`;
}

export function formatClock(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const dtf = new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return dtf.format(date);
}

export function formatDay(dayOfWeek: number) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return days[dayOfWeek - 1] ?? `Day ${dayOfWeek}`;
}

export function formatHours(opensAt: string | null, closesAt: string | null, closed: boolean) {
  if (closed) return "Closed";
  const open = opensAt?.slice(0, 5);
  const close = closesAt?.slice(0, 5);
  if (!open || !close) return "Hours TBC";
  return `${open}–${close}`;
}

export type AuditEvent = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
};
