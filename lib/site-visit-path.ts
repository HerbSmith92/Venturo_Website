const BLOCKED = /^\/(admin|api|portal|companion)(\/|$)/i;
const PATH = /^\/[A-Za-z0-9/_-]{0,199}$/;

const STATIC_LABELS: Record<string, string> = {
  "/": "Home",
  "/directory": "Directory",
  "/events": "What's On",
  "/event-guides": "Event Guides",
  "/guides": "Guides",
  "/communities": "Communities",
  "/authors": "Authors",
  "/join": "Join",
  "/login": "Log In",
  "/signup": "Sign Up",
  "/about": "About",
  "/get-the-app": "Get the App",
  "/list-your-business": "List Your Business",
  "/account": "Account",
  "/account/events": "My Events",
  "/event-host": "Event Host",
};

export function publicVisitPath(raw: unknown) {
  if (typeof raw !== "string") return null;
  let path = raw.trim();
  const cut = path.indexOf("?");
  if (cut >= 0) path = path.slice(0, cut);
  const hash = path.indexOf("#");
  if (hash >= 0) path = path.slice(0, hash);
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 200) path = path.slice(0, 200);
  if (!PATH.test(path)) return null;
  if (BLOCKED.test(path)) return null;
  return path;
}

export function publicPageLabel(path: string, titles?: Map<string, string>) {
  if (STATIC_LABELS[path]) return STATIC_LABELS[path];
  const event = path.match(/^\/events\/([^/]+)$/);
  if (event) return titles?.get(`event:${event[1]}`) ?? event[1].replace(/-/g, " ");
  const listing = path.match(/^\/directory\/([^/]+)$/);
  if (listing) return titles?.get(`listing:${listing[1]}`) ?? listing[1].replace(/-/g, " ");
  const guide = path.match(/^\/(?:event-guides|guides)\/([^/]+)$/);
  if (guide) return titles?.get(`guide:${guide[1]}`) ?? guide[1].replace(/-/g, " ");
  const community = path.match(/^\/communities\/([^/]+)$/);
  if (community) return titles?.get(`community:${community[1]}`) ?? community[1].replace(/-/g, " ");
  return path;
}

export function screenKey(raw: unknown) {
  if (typeof raw !== "string") return null;
  const screen = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(screen)) return null;
  return screen;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEM_KINDS = ["listing", "event", "community", "guide"] as const;
export type AppItemKind = (typeof ITEM_KINDS)[number];

export function appItemKind(raw: unknown): AppItemKind | null {
  if (typeof raw !== "string") return null;
  const kind = raw.trim().toLowerCase();
  return ITEM_KINDS.includes(kind as AppItemKind) ? (kind as AppItemKind) : null;
}

export function appItemId(raw: unknown) {
  if (typeof raw !== "string") return null;
  const id = raw.trim().toLowerCase();
  return UUID.test(id) ? id : null;
}

export function screenLabel(screen: string) {
  return screen
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatStay(seconds: number, visits: number) {
  if (!visits || seconds <= 0) return "—";
  const average = Math.round(seconds / visits);
  if (average < 60) return `${average} s`;
  const minutes = Math.floor(average / 60);
  const rest = average % 60;
  if (rest === 0) return `${minutes} min`;
  return `${minutes} min ${rest} s`;
}
