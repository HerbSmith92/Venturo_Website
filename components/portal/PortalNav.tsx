"use client";

import { usePathname } from "next/navigation";
import { PORTAL_NAV } from "@/lib/portal";

export function PortalNav() {
  const path = usePathname();

  return (
    <nav className="portal-rail" aria-label="Event Host">
      <div className="colour-bar" aria-hidden="true" />
      <div className="portal-rail-links">
        {PORTAL_NAV.map((item) => {
          const active = item.exact
            ? path === item.href
            : path === item.href || path.startsWith(`${item.href}/`);
          return (
            <a
              key={item.href}
              className={active ? "portal-rail-link active" : "portal-rail-link"}
              href={item.href}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
