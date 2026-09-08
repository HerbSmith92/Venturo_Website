export const PORTAL_HOME = "/portal";
export const PORTAL_LOGIN = "/portal/login";
export const PORTAL_EVENTS = "/portal/events";
export const PORTAL_SETTINGS = "/portal/settings";
export const PORTAL_SETTINGS_BANK = `${PORTAL_SETTINGS}?tab=bank`;
export const EVENT_HOST = "/event-host";

export const PORTAL_NAV = [
  { href: PORTAL_HOME, label: "Home", exact: true },
  { href: PORTAL_EVENTS, label: "My Events", exact: false },
  { href: PORTAL_SETTINGS, label: "Host Settings", exact: true },
] as const;

export const EVENT_MENU_ITEMS = [
  {
    id: "dashboard",
    slug: "dashboard",
    label: "Event Dashboard",
    lede: "Income, tickets, visits & conversion. Quick actions live here.",
  },
  {
    id: "manage",
    slug: "manage",
    label: "Manage Event",
    lede: "Details, postpone, cancel, copy & who else can help.",
  },
  {
    id: "checkout",
    slug: "checkout",
    label: "Manage Checkout",
    lede: "Ticket types guests pick when they pay.",
  },
  {
    id: "payment",
    slug: "payment",
    label: "Payment",
    lede: "PayFast for tickets. Payouts 3 working days after the event.",
  },
  {
    id: "marketing",
    slug: "marketing",
    label: "Marketing",
    lede: "Ambassador codes, ad campaign links & invite links.",
  },
  {
    id: "guests",
    slug: "guests",
    label: "Guest Management",
    lede: "The list, comps, RSVPs & the door.",
  },
  {
    id: "settings",
    slug: "settings",
    label: "Settings",
    lede: "Who can see this listing. Bank stays in Host Settings.",
  },
] as const;

export type EventMenuId = (typeof EVENT_MENU_ITEMS)[number]["id"];

export function portalEventHref(id: string) {
  return `${PORTAL_EVENTS}/${id}`;
}

export function portalEventSectionHref(id: string, slug: string) {
  return `${PORTAL_EVENTS}/${id}/${slug}`;
}

export function portalDoorHref(id: string) {
  return `${PORTAL_EVENTS}/${id}/door`;
}

export function portalMarketingInvitesHref(id: string) {
  return `${portalEventSectionHref(id, "marketing")}?tab=invites`;
}

const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EventMenuSection = EventMenuId | "menu" | "door";

export function parsePortalEventPath(path: string): {
  eventId: string;
  section: EventMenuSection;
} | null {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "portal" || parts[1] !== "events" || !parts[2] || !EVENT_ID.test(parts[2])) {
    return null;
  }
  const eventId = parts[2];
  const slug = parts[3];
  if (!slug) return { eventId, section: "menu" };
  if (slug === "door") return { eventId, section: "door" };
  const item = EVENT_MENU_ITEMS.find((entry) => entry.slug === slug);
  if (item) return { eventId, section: item.id };
  return { eventId, section: "menu" };
}

export function isPortalPath(path: string) {
  return path === PORTAL_HOME || path.startsWith(`${PORTAL_HOME}/`);
}

export function portalLoginHref(join = false) {
  return join ? `${PORTAL_LOGIN}?join=1` : PORTAL_LOGIN;
}
