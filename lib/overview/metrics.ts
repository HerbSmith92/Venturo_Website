/** Johannesburg is UTC+2 all year. Dashboard days follow that clock. */
export const JOHANNESBURG_OFFSET_MS = 2 * 60 * 60 * 1000;

export const RANGE_KEYS = ["today", "7d", "30d", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const PLATFORM_FILTERS = ["all", "web", "ios", "android"] as const;
export type PlatformFilter = (typeof PLATFORM_FILTERS)[number];

export type ReportRange = {
  key: RangeKey;
  start: Date;
  end: Date;
  label: string;
};

export type MetricComparison = {
  state: "ready" | "unavailable";
  text: string;
};

export function isRangeKey(value: string | undefined): value is RangeKey {
  return RANGE_KEYS.includes(value as RangeKey);
}

export function isPlatformFilter(value: string | undefined): value is PlatformFilter {
  return PLATFORM_FILTERS.includes(value as PlatformFilter);
}

export function johannesburgDayStart(now: Date) {
  const shifted = new Date(now.getTime() + JOHANNESBURG_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      JOHANNESBURG_OFFSET_MS,
  );
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function johannesburgDateKey(date: Date) {
  const shifted = new Date(date.getTime() + JOHANNESBURG_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseJohannesburgDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day) - JOHANNESBURG_OFFSET_MS);
  if (johannesburgDateKey(date) !== value) return null;
  return date;
}

export function resolveRange(
  input: { range?: string; from?: string; to?: string },
  now = new Date(),
): ReportRange {
  const key: RangeKey = isRangeKey(input.range) ? input.range : "7d";
  if (key === "today") {
    return { key, start: johannesburgDayStart(now), end: now, label: "Today" };
  }
  if (key === "30d") {
    return {
      key,
      start: addDays(johannesburgDayStart(now), -29),
      end: now,
      label: "Last 30 days",
    };
  }
  if (key === "custom") {
    let start = parseJohannesburgDate(input.from) ?? addDays(johannesburgDayStart(now), -6);
    let toDay = parseJohannesburgDate(input.to) ?? johannesburgDayStart(now);
    if (toDay.getTime() < start.getTime()) {
      const swap = start;
      start = toDay;
      toDay = swap;
    }
    const dayAfter = addDays(toDay, 1);
    const end = dayAfter.getTime() > now.getTime() ? now : new Date(dayAfter.getTime() - 1);
    return { key, start, end, label: "Custom" };
  }
  return {
    key: "7d",
    start: addDays(johannesburgDayStart(now), -6),
    end: now,
    label: "Last 7 days",
  };
}

export function previousRange(range: Pick<ReportRange, "start" | "end">) {
  const length = Math.max(0, range.end.getTime() - range.start.getTime());
  const end = new Date(range.start.getTime() - 1);
  const start = new Date(end.getTime() - length);
  return { start, end };
}

export function inRange(iso: string | null | undefined, start: Date, end: Date) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
}

/** Same patterns as public.metrics_excluded_user_ids. */
export function isTestEmail(email: string | null | undefined) {
  const value = (email ?? "").trim().toLowerCase();
  if (!value) return false;
  return (
    value.startsWith("test@") ||
    value.includes("+test@") ||
    value.endsWith("@example.com") ||
    value.endsWith("@example.org")
  );
}

export function uniqueIds(ids: Iterable<string | null | undefined>) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (id) seen.add(id);
  }
  return seen.size;
}

export function percentDelta(current: number, previous: number) {
  if (previous === 0 && current === 0) return "0% vs previous period";
  if (previous === 0) return "No earlier baseline";
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs previous period`;
}

export function ageFrom(fromIso: string | null | undefined, now: Date) {
  const from = fromIso ? new Date(fromIso).getTime() : Number.NaN;
  const hours = Number.isFinite(from) ? Math.max(0, (now.getTime() - from) / 3_600_000) : 0;
  if (!Number.isFinite(from)) return { label: "—", hours: 0 };
  if (hours < 1) return { label: `${Math.max(1, Math.round(hours * 60))} min`, hours };
  if (hours < 48) return { label: `${Math.round(hours)} h`, hours };
  return { label: `${Math.floor(hours / 24)} d`, hours };
}

/**
 * Host money from the stored order.
 * commission_cents and booking_fee_cents are Venturo's ticketing fees.
 * Fees added on top of the subtotal (total > subtotal) were passed to the
 * buyer, so they are not deducted from the host. Fees inside the subtotal
 * are deducted. Paystack's gateway fee is not in the ledger.
 * Promo codes that reduce total below subtotal are treated as host-side.
 */
export function hostOwedCents(order: {
  subtotalCents: number;
  commissionCents: number;
  bookingFeeCents: number;
  totalCents: number;
}) {
  const fees = Math.max(0, order.commissionCents) + Math.max(0, order.bookingFeeCents);
  const passed = Math.max(0, order.totalCents - order.subtotalCents);
  const passedFees = Math.min(fees, passed);
  return Math.max(0, order.subtotalCents - (fees - passedFees));
}

export function venturoFeeCents(order: { commissionCents: number; bookingFeeCents: number }) {
  return Math.max(0, order.commissionCents) + Math.max(0, order.bookingFeeCents);
}

export function formatZar(cents: number) {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-ZA").format(value);
}

export function formatWhen(iso: string | null | undefined, withTime = true) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).format(date);
}

export function formatClockOnly(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function platformLabel(platform: PlatformFilter) {
  if (platform === "web") return "Website";
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  return "All platforms";
}

export type AttentionSeverity = "critical" | "high" | "medium" | "low";

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function compareAttention(
  left: { severity: AttentionSeverity; ageHours: number },
  right: { severity: AttentionSeverity; ageHours: number },
) {
  return SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] || right.ageHours - left.ageHours;
}
