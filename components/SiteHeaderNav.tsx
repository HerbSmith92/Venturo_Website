"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CurrentUser } from "@/lib/auth";

export function SiteHeaderNav({ user }: { user: CurrentUser | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="nav-bar" ref={rootRef}>
      {user ? (
        <a className="btn btn-primary nav-signup" href="/account">
          {profileLabel}
        </a>
      ) : (
        <a className="btn btn-primary nav-signup" href="/signup">
          Sign Up
        </a>
      )}

      <button
        type="button"
        className={`nav-burger${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <div className="nav-drawer-panel" id={panelId}>
          <nav className="nav-drawer-links" aria-label="Site menu">
            <a href="/directory">Directory</a>
            <a href="/events">Events</a>
            <a href="/communities">Communities</a>
            <a href="/admin">Admin</a>
            {user ? (
              <>
                <a href="/account">{profileLabel}</a>
                <form action="/auth/sign-out" method="post">
                  <button type="submit">Sign Out</button>
                </form>
              </>
            ) : (
              <a href="/login">Log In</a>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
