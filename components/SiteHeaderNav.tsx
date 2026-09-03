"use client";

import { useEffect, useId, useState } from "react";
import type { CurrentUser } from "@/lib/auth";
import { PAID_PRICE } from "@/lib/brand";

export function SiteHeaderNav({ user }: { user: CurrentUser | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const profileLabel =
    user?.firstName && user.firstName !== "there" ? user.firstName : "Profile";

  return (
    <>
      <div className="nav-cta">
        {user ? (
          <a className="btn btn-primary" href="/account">
            {profileLabel}
          </a>
        ) : (
          <a className="btn btn-primary" href="/signup">
            Sign Up
          </a>
        )}
        <button
          type="button"
          className="nav-burger"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <nav className="nav-actions nav-actions-desktop" aria-label="Site">
        <a className="btn btn-ghost" href="/directory">
          Directory
        </a>
        <a className="btn btn-ghost" href="/guides">
          Guides
        </a>
        <a className="btn btn-ghost" href="/events">
          Events
        </a>
        <a className="btn btn-ghost" href="/communities">
          Communities
        </a>
        <a className="btn btn-ghost" href="/admin">
          Admin
        </a>
        {user ? (
          <>
            <a className="btn btn-ghost" href="/events/create">
              Create Event
            </a>
            <a className="btn btn-ghost" href="/account">
              {profileLabel}
            </a>
            <form action="/auth/sign-out" method="post">
              <button className="btn btn-secondary" type="submit">
                Sign Out
              </button>
            </form>
          </>
        ) : (
          <>
            <a className="btn btn-ghost" href="/login">
              Log In
            </a>
            <a className="btn btn-primary" href="/signup">
              Sign Up
            </a>
          </>
        )}
      </nav>

      {open && (
        <div className="nav-drawer">
          <button
            type="button"
            className="nav-drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="nav-drawer-panel" id={panelId} role="dialog" aria-modal="true">
            <p className="eyebrow">Explore Venturo</p>
            <nav className="nav-drawer-links" aria-label="Mobile site">
              <a href="/directory" onClick={() => setOpen(false)}>
                Directory
              </a>
              <a href="/guides" onClick={() => setOpen(false)}>
                Guides
              </a>
              <a href="/events" onClick={() => setOpen(false)}>
                Events
              </a>
              <a href="/communities" onClick={() => setOpen(false)}>
                Communities
              </a>
              <a href="/admin" onClick={() => setOpen(false)}>
                Admin
              </a>
              {user ? (
                <>
                  <a href="/events/create" onClick={() => setOpen(false)}>
                    Create Event
                  </a>
                  <a href="/account" onClick={() => setOpen(false)}>
                    {profileLabel}
                  </a>
                </>
              ) : (
                <a href="/login" onClick={() => setOpen(false)}>
                  Log In
                </a>
              )}
            </nav>
            <div className="nav-drawer-cta">
              {user ? (
                <a className="btn btn-primary" href="/join/subscribe" onClick={() => setOpen(false)}>
                  Explore From {PAID_PRICE}/mo
                </a>
              ) : (
                <>
                  <a className="btn btn-primary" href="/signup" onClick={() => setOpen(false)}>
                    Sign Up Free
                  </a>
                  <a className="btn btn-secondary" href="/join" onClick={() => setOpen(false)}>
                    From {PAID_PRICE} / month
                  </a>
                </>
              )}
              {user && (
                <form action="/auth/sign-out" method="post">
                  <button className="btn btn-secondary" type="submit">
                    Sign Out
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
