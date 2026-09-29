export const LISTING_STATUSES = ["draft", "review", "approved", "archived"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_ACTIONS = [
  "approve",
  "review",
  "draft",
  "archive",
  "feature",
  "suspend",
  "unsuspend",
] as const;
export type ListingAction = (typeof LISTING_ACTIONS)[number];

export function isListingStatus(value: string): value is ListingStatus {
  return LISTING_STATUSES.includes(value as ListingStatus);
}

export function isListingAction(value: string): value is ListingAction {
  return LISTING_ACTIONS.includes(value as ListingAction);
}

export function listingStatusLabel(status: string, flags?: { suspended?: boolean; scheduled?: boolean }) {
  if (flags?.suspended) return "Suspended";
  if (flags?.scheduled) return "Scheduled";
  if (status === "approved") return "Live";
  if (status === "review") return "New Listings Requested";
  if (status === "archived") return "Archived";
  if (status === "draft") return "Changes Requested";
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
  if (dayOfWeek === 8) return "Public Holiday";
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return days[dayOfWeek - 1] ?? `Day ${dayOfWeek}`;
}

export function formatHours(opensAt: string | null, closesAt: string | null, closed: boolean) {
  if (closed) return "Closed";
  const open = opensAt?.slice(0, 5);
  const close = closesAt?.slice(0, 5);
  if (!open || !close) return "Hours TBC";
  return `${open} – ${close}`;
}

export type AuditEvent = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
  actor_name: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

const AUDIT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const AUDIT_DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Public Holiday"];

const AUDIT_FIELD_LABELS: Record<string, string> = {
  name: "Business name",
  branch_name: "Branch",
  short_description: "Short description",
  description: "Long description",
  phone: "Contact number",
  email: "Email address",
  website_url: "Website",
  booking_url: "Booking link",
  street_address_1: "Street address",
  street_address_2: "Address line 2",
  suburb: "Suburb",
  city: "City",
  province: "Province",
  postal_code: "Postal code",
  maps_url: "Google Maps link",
  booking_required: "Booking required",
  indoor_outdoor: "Indoor or outdoor",
  interest_keywords: "Interest keywords",
  persona_keywords: "Persona keywords",
  authorised_to_submit: "Authorised to submit",
  image_rights_granted: "Image & copy permission",
  terms_accepted: "Terms agreement",
  status: "Status",
  hours: "Operating hours",
  activities: "Activities & costs",
  personas: "Persona",
  interests: "Interests",
  kinds: "Categories",
  scale: "Adventure level",
  social: "Social handles",
  photo_count: "Photos",
};

export function formatAuditWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const month = AUDIT_MONTHS[Number(read("month")) - 1] ?? read("month");
  return `${read("day")} ${month} ${read("year")}, ${read("hour")}:${read("minute")}`;
}

function auditText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

function hourLine(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  const day = AUDIT_DAYS[Number(row.day)] ?? "Day";
  const normal = row.closed
    ? `${day} closed`
    : `${day} ${auditText(row.opens) || "—"}–${auditText(row.closes) || "—"}`;
  if (row.vacation_closed) return `${normal}; school vacation closed`;
  if (row.vacation_opens || row.vacation_closes) {
    return `${normal}; school vacation ${auditText(row.vacation_opens) || "—"}–${auditText(row.vacation_closes) || "—"}`;
  }
  return normal;
}

function activityLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((activity) => {
    if (!activity || typeof activity !== "object") return [];
    const row = activity as Record<string, unknown>;
    const name = auditText(row.name) || "Activity";
    const prices = Array.isArray(row.prices) ? row.prices : [];
    if (prices.length === 0) return [name];
    return prices.map((price) => {
      if (!price || typeof price !== "object") return name;
      const item = price as Record<string, unknown>;
      const priceName = auditText(item.name);
      return priceName ? `${name}: ${priceName}` : name;
    });
  });
}

function auditLines(key: string, value: unknown) {
  if (key === "hours" && Array.isArray(value)) return value.map(hourLine).filter(Boolean);
  if (key === "activities") return activityLines(value);
  if (Array.isArray(value)) return value.map((item) => auditText(item)).filter(Boolean);
  const text = auditText(value);
  return text ? [text] : [];
}

export type AuditChange = {
  label: string;
  lines: string[];
};

export function auditChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditChange[] {
  const left = before ?? {};
  const right = after ?? {};
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  const changes: AuditChange[] = [];

  for (const key of keys) {
    const from = auditLines(key, left[key]);
    const to = auditLines(key, right[key]);
    if (from.join("\n") === to.join("\n")) continue;
    const label = AUDIT_FIELD_LABELS[key] ?? key;
    const removed = from.filter((line) => !to.includes(line));
    const added = to.filter((line) => !from.includes(line));
    const many = from.length > 1 || to.length > 1 || key === "hours" || key === "activities";
    if (many) {
      const lines = [
        ...removed.map((line) => `Removed ${line}`),
        ...added.map((line) => `Added ${line}`),
      ];
      if (lines.length) changes.push({ label, lines });
      continue;
    }
    const previous = from[0] ? (key === "status" ? listingStatusLabel(from[0]) : from[0]) : "";
    const next = to[0] ? (key === "status" ? listingStatusLabel(to[0]) : to[0]) : "";
    if (previous.length > 120 || next.length > 120) {
      changes.push({
        label,
        lines: [previous ? `Was: ${previous}` : "Was empty", next ? `Now: ${next}` : "Now empty"],
      });
      continue;
    }
    if (!previous) changes.push({ label, lines: [`Added ${next}`] });
    else if (!next) changes.push({ label, lines: [`Removed ${previous}`] });
    else changes.push({ label, lines: [`${previous} → ${next}`] });
  }

  return changes;
}
