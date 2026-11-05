"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { MenuIcon, type MenuIconName } from "@/components/menu/MenuIcon";
import { isStaff } from "@/lib/roles";

const PRIMARY_LINKS: { href: string; label: string }[] = [
  { href: "/directory", label: "Activities" },
  { href: "/events", label: "Events" },
  { href: "/communities", label: "Communities" },
  { href: "/guides", label: "Guides" },
];

const SITE_LINKS: { href: string; label: string; icon: MenuIconName }[] = [
  { href: "/directory", label: "Activities", icon: "grid" },
  { href: "/events", label: "Events", icon: "calendar" },
  { href: "/communities", label: "Communities", icon: "flag" },
  { href: "/guides", label: "Guides", icon: "book" },
  { href: "/authors", label: "Authors", icon: "user" },
];

export function SiteHeaderNav({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const staff = isStaff(user?.role);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const profileLabel =
    user?.firstName && user.firstName !== "there" ? user.firstName : "My Venturo";

  function current(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined;
  }

  return (
    <div className="nav-bar" ref={rootRef}>
      <nav className="nav-actions-desktop" aria-label="Primary">
        {PRIMARY_LINKS.map((item) => (
          <a key={item.href} href={item.href} aria-current={current(item.href)}>
            {item.label}
          </a>
        ))}
      </nav>

      {user ? (
        <a className="btn btn-primary nav-signup" href="/account">
          {profileLabel}
        </a>
      ) : (
        <a className="btn btn-primary nav-signup" href="/login">
          Log In / Sign Up
        </a>
      )}

      <button
        type="button"
        className={`nav-burger${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <div className="nav-drawer-panel" id={panelId}>
          <nav className="nav-drawer-links" aria-label="Site menu">
            {SITE_LINKS.map((item) => (
              <a key={item.href} href={item.href} aria-current={current(item.href)}>
                <MenuIcon name={item.icon} />
                <span>{item.label}</span>
              </a>
            ))}
            {staff ? (
              <a href="/admin" aria-current={current("/admin")}>
                <MenuIcon name="settings" />
                <span>Admin</span>
              </a>
            ) : null}
            {user ? (
              <>
                <a href="/account" aria-current={current("/account")}>
                  <MenuIcon name="user" />
                  <span>{profileLabel}</span>
                </a>
                <form action="/auth/sign-out" method="post">
                  <button type="submit">
                    <MenuIcon name="logout" />
                    <span>Sign Out</span>
                  </button>
                </form>
              </>
            ) : (
              <a href="/login" aria-current={pathname === "/login" ? "page" : undefined}>
                <MenuIcon name="user" />
                <span>Log In / Sign Up</span>
              </a>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
