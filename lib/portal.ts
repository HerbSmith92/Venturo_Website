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

export function portalEventHref(id: string) {
  return `${PORTAL_EVENTS}/${id}`;
}

export function isPortalPath(path: string) {
  return path === PORTAL_HOME || path.startsWith(`${PORTAL_HOME}/`);
}

export function portalLoginHref(join = false) {
  return join ? `${PORTAL_LOGIN}?join=1` : PORTAL_LOGIN;
}
