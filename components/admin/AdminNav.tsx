"use client";

import { usePathname } from "next/navigation";
import type { StaffSession } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "Directory" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/staff", label: "Staff" },
];

export function AdminNav({ user }: { user: StaffSession }) {
  const path = usePathname();
  return (
    <aside className="cr-nav">
      <a className="cr-brand" href="/admin" aria-label="Control Room home">
        <img src="/brand/logos/venturo-horizontal-light.svg" alt="Venturo" />
        <span>Control Room</span>
      </a>
      <nav aria-label="Control Room">
        {NAV.map((item) => {
          const active = item.href === "/admin" ? path === "/admin" : path.startsWith(item.href);
          return (
            <a key={item.href} className={active ? "cr-link active" : "cr-link"} href={item.href}>
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="cr-nav-foot">
        <p className="muted">{user.email}</p>
        <a className="cr-link" href="/">
          Public Site
        </a>
        <form action="/auth/sign-out" method="post">
          <input type="hidden" name="next" value="/admin/login" />
          <button className="btn btn-secondary" type="submit">
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
