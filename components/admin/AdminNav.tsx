"use client";

import { usePathname } from "next/navigation";
import type { StaffSession } from "@/lib/auth";

const CONTENT = [
  { href: "/admin/listings", label: "Directory" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/communities", label: "Communities" },
  { href: "/admin/guides", label: "Guides" },
  { href: "/admin/website", label: "Website" },
];

const OPERATIONS = [
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/claims", label: "Claims" },
  { href: "/admin/operations", label: "Orders" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/staff", label: "Staff" },
];

function NavLinks({
  items,
  path,
}: {
  items: { href: string; label: string }[];
  path: string;
}) {
  return items.map((item) => {
    const active = path.startsWith(item.href);
    return (
      <a key={item.href} className={active ? "cr-link active" : "cr-link"} href={item.href}>
        {item.label}
      </a>
    );
  });
}

export function AdminNav({ user }: { user: StaffSession }) {
  const path = usePathname();
  const overview = path === "/admin";
  return (
    <aside className="cr-nav">
      <a className="cr-brand" href="/admin" aria-label="Control Room home">
        <img src="/brand/logos/venturo-horizontal-light.svg" alt="Venturo" />
        <span>Control Room</span>
      </a>
      <nav aria-label="Control Room">
        <a className={overview ? "cr-link active" : "cr-link"} href="/admin">
          Overview
        </a>
        <p className="cr-nav-label">Content</p>
        <div className="cr-nav-group">
          <NavLinks items={CONTENT} path={path} />
        </div>
        <p className="cr-nav-label">Operations</p>
        <div className="cr-nav-group">
          <NavLinks items={OPERATIONS} path={path} />
        </div>
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
