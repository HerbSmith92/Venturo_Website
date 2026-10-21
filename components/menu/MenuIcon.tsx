import type { ReactNode } from "react";

export type MenuIconName =
  | "user"
  | "bookmark"
  | "ticket"
  | "star"
  | "card"
  | "lock"
  | "users"
  | "compass"
  | "pulse"
  | "calendar"
  | "flag"
  | "plus"
  | "list"
  | "chart"
  | "sliders"
  | "megaphone"
  | "settings"
  | "door"
  | "grid"
  | "bell"
  | "book"
  | "logout"
  | "home"
  | "spark";

const PATHS: Record<MenuIconName, ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.2 19.2c.9-3.1 3.4-4.7 6.8-4.7s5.9 1.6 6.8 4.7" />
    </>
  ),
  bookmark: (
    <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.2L6 20V5.5a1 1 0 0 1 1-1z" />
  ),
  ticket: (
    <>
      <path d="M4.5 8.5a2 2 0 0 0 2-2h11a2 2 0 0 0 2 2v2.2a2 2 0 0 1 0 2.6v2.2a2 2 0 0 0-2 2h-11a2 2 0 0 0-2-2v-2.2a2 2 0 0 1 0-2.6z" />
      <path d="M12 7.2v9.6" />
    </>
  ),
  star: <path d="m12 3.8 1.9 4.7 5.1.4-3.9 3.2 1.2 4.9L12 14.8 7.7 17l1.2-4.9L5 8.9l5.1-.4z" />,
  card: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M3.5 10h17" />
    </>
  ),
  lock: (
    <>
      <rect x="6" y="10.5" width="12" height="8.5" rx="1.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="2.4" />
      <path d="M4.8 18c.5-2.4 2.2-3.6 4.2-3.6s3.7 1.2 4.2 3.6" />
      <circle cx="16" cy="9.2" r="2" />
      <path d="M15.2 14.5c1.6.2 2.8 1.2 3.4 3.5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m14.8 9.2-1.2 4.4-4.4 1.2 1.2-4.4z" />
    </>
  ),
  pulse: <path d="M3 12h4l2-5 3.2 10L15 12h6" />,
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M8 3.8v3.4M16 3.8v3.4" />
    </>
  ),
  flag: (
    <>
      <path d="M6 4.5v15" />
      <path d="M6 5.5h11l-2.2 3.2L17 12H6" />
    </>
  ),
  plus: <path d="M12 6v12M6 12h12" />,
  list: (
    <>
      <path d="M9 7h10M9 12h10M9 17h10" />
      <path d="M5 7h.01M5 12h.01M5 17h.01" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19h16" />
      <path d="M7 16V11M12 16V7M17 16v-4" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 8h16M4 16h16" />
      <circle cx="9" cy="8" r="2" />
      <circle cx="15" cy="16" r="2" />
    </>
  ),
  megaphone: (
    <>
      <path d="M5 10v4l11 3.5V6.5z" />
      <path d="M16 9.2a3 3 0 0 1 0 5.6M7 14.2v2.3a2 2 0 0 0 2 1.8h.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.6v2.2M12 18.2v2.2M3.6 12h2.2M18.2 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6" />
    </>
  ),
  door: (
    <>
      <path d="M6 20V5.5A1.5 1.5 0 0 1 7.5 4H16a1.5 1.5 0 0 1 1.5 1.5V20" />
      <path d="M4.5 20h15" />
      <path d="M14 12h.01" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 16.5h11l-1.2-1.6V10a4.3 4.3 0 0 0-8.6 0v4.9z" />
      <path d="M10 16.5a2 2 0 0 0 4 0" />
    </>
  ),
  book: (
    <>
      <path d="M5 5.5A2 2 0 0 1 7 4h12v14.5H7a2 2 0 0 0-2 2z" />
      <path d="M5 5.5v15" />
    </>
  ),
  logout: (
    <>
      <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4H18a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20h-6.5A1.5 1.5 0 0 1 10 18.5V17" />
      <path d="M4 12h10M11 9l3 3-3 3" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.2 12 4.5l8 6.7" />
      <path d="M7 10.5V19h10v-8.5" />
    </>
  ),
  spark: (
    <path d="M12 3.5 13.4 9 19 10.5 13.4 12 12 17.5 10.6 12 5 10.5 10.6 9z" />
  ),
};

export function MenuIcon({ name }: { name: MenuIconName }) {
  return (
    <svg className="v-menu-icon" viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function MenuChevron() {
  return (
    <svg className="v-chevron-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function iconFor(id: string, label = ""): MenuIconName {
  const blob = `${id} ${label}`.toLowerCase();
  if (blob.includes("sign-out") || blob.includes("log out") || blob.includes("sign out")) return "logout";
  if (blob.includes("add") || label.trim().startsWith("+")) return "plus";
  if (blob.includes("setting")) return "settings";
  if (blob.includes("door")) return "door";
  if (blob.includes("dashboard") || blob.includes("analytic")) return "chart";
  if (blob.includes("checkout") || blob.includes("ticket")) return "ticket";
  if (blob.includes("payment") || blob.includes("wallet") || blob.includes("token") || blob.includes("membership")) return "card";
  if (blob.includes("market")) return "megaphone";
  if (blob.includes("guest") || blob.includes("member") || blob.includes("going") || blob.includes("go out") || blob.includes("how-you")) return "users";
  if (blob.includes("interest") || blob.includes("discover")) return "compass";
  if (blob.includes("activity") || blob.includes("adventure") || blob.includes("pulse")) return "pulse";
  if (blob.includes("saved") || blob.includes("bucket") || blob.includes("archiv")) return "bookmark";
  if (blob.includes("privacy") || blob.includes("suspend") || blob.includes("reject") || blob.includes("cancel")) return "lock";
  if (blob.includes("request") || blob.includes("notif") || blob.includes("push")) return "bell";
  if (blob.includes("review") || blob.includes("star") || blob.includes("achieve") || blob.includes("featured") || blob.includes("hot")) return "star";
  if (blob.includes("guide") || blob.includes("legal") || blob.includes("book")) return "book";
  if (blob.includes("draft")) return "sliders";
  if (blob.includes("manage") || blob.includes("slider")) return "sliders";
  if (blob.includes("event") || blob.includes("calendar") || blob.includes("scheduled")) return "calendar";
  if (blob.includes("communit")) return "flag";
  if (blob.includes("published") || blob.includes("banner") || blob.includes("spark")) return "spark";
  if (blob.includes("directory") || blob.includes("overview") || blob.includes("grid")) return "grid";
  if (blob.includes("profile") || blob.includes("account")) return "user";
  if (blob.includes("public") || blob.includes("home")) return "home";
  if (label.trim().toLowerCase().startsWith("all")) return "list";
  return "list";
}

export function pinMenuFlyout(host: HTMLElement) {
  const sub = host.querySelector(":scope > .account-subnav, :scope > .cr-subnav");
  if (!(sub instanceof HTMLElement)) return;
  if (!host.closest(".is-collapsed") || window.matchMedia("(max-width: 900px)").matches) {
    host.classList.remove("is-fly");
    sub.style.position = "";
    sub.style.top = "";
    sub.style.left = "";
    sub.style.zIndex = "";
    return;
  }
  host.classList.add("is-fly");
  const rect = host.getBoundingClientRect();
  sub.style.position = "fixed";
  sub.style.left = `${rect.right + 8}px`;
  sub.style.zIndex = "80";
  const height = sub.offsetHeight || 240;
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - height - 8));
  sub.style.top = `${top}px`;
}

export function clearMenuFlyout(host: HTMLElement) {
  host.classList.remove("is-fly");
  const sub = host.querySelector(":scope > .account-subnav, :scope > .cr-subnav");
  if (!(sub instanceof HTMLElement)) return;
  sub.style.position = "";
  sub.style.top = "";
  sub.style.left = "";
  sub.style.zIndex = "";
}
