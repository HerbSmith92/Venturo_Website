"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MenuChevron, MenuIcon, clearMenuFlyout, pinMenuFlyout, type MenuIconName } from "@/components/menu/MenuIcon";
import {
  EVENT_MENU_ITEMS,
  PORTAL_EVENTS,
  PORTAL_EVENTS_NEW,
  parsePortalEventPath,
  portalDoorHref,
  portalEventSectionHref,
} from "@/lib/portal";

const EVENT_ICONS: Record<string, MenuIconName> = {
  dashboard: "chart",
  manage: "sliders",
  checkout: "ticket",
  payment: "card",
  marketing: "megaphone",
  guests: "users",
  settings: "settings",
  door: "door",
};

function isCurrent(pathname: string, href: string) {
  if (href === "/account") return pathname === "/account";
  if (href === "/account/community") return pathname === "/account/community";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountNav({
  host,
  events,
  communities,
  collapsed,
  onToggleCollapsed,
}: {
  host: boolean;
  events: { id: string; title: string }[];
  communities: { id: string; title: string }[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const eventPath = parsePortalEventPath(pathname);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (collapsed) return;
    document.querySelectorAll(".account-rail .account-subnav").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.style.position = "";
      node.style.top = "";
      node.style.left = "";
      node.style.zIndex = "";
    });
  }, [collapsed]);

  function isOpen(id: string, fallback: boolean) {
    if (id in open) return open[id];
    return fallback;
  }

  function setFold(id: string, fallback: boolean) {
    setOpen((current) => ({ ...current, [id]: !(id in current ? current[id] : fallback) }));
  }

  const eventsOpen = isOpen("events", host);
  const communitiesOpen = isOpen("communities", true);

  const groups: { label: string; items: { href: string; label: string; icon: MenuIconName }[] }[] = [
    {
      label: "You",
      items: [
        { href: "/account", label: "Profile", icon: "user" },
        { href: "/account/saved", label: "Saved", icon: "bookmark" },
        { href: "/account/tickets", label: "Tickets", icon: "ticket" },
        { href: "/account/reviews", label: "Reviews", icon: "star" },
        { href: "/account/membership", label: "Membership", icon: "card" },
        { href: "/account/privacy", label: "Privacy", icon: "lock" },
      ],
    },
    {
      label: "Made For You",
      items: [
        { href: "/account/going-out", label: "Going Out", icon: "users" },
        { href: "/account/interests", label: "Interests", icon: "compass" },
        { href: "/account/activity", label: "Activity Level", icon: "pulse" },
      ],
    },
  ];

  return (
    <nav className={collapsed ? "account-rail is-collapsed" : "account-rail"} aria-label="Profile">
      <div className="v-menu-top">
        <button
          type="button"
          className="v-collapse"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand menu" : "Minimise menu"}
          onClick={onToggleCollapsed}
        >
          <MenuChevron />
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.label} className="account-rail-group">
          <p className="account-rail-label">{group.label}</p>
          {group.items.map((item) => (
            <a
              key={item.href}
              className="v-item"
              href={item.href}
              aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
              title={item.label}
            >
              <MenuIcon name={item.icon} />
              <span className="v-label">{item.label}</span>
            </a>
          ))}
        </div>
      ))}

      <div className="account-rail-group">
        <p className="account-rail-label">Host &amp; Community</p>
        {host ? (
          <div
            className={eventsOpen ? "account-fold open" : "account-fold"}
            onMouseEnter={(event) => pinMenuFlyout(event.currentTarget)}
            onMouseLeave={(event) => clearMenuFlyout(event.currentTarget)}
            onFocus={(event) => pinMenuFlyout(event.currentTarget)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) clearMenuFlyout(event.currentTarget);
            }}
          >
            <div className="account-fold-row">
              <a className="v-item" href={PORTAL_EVENTS} title="My Events">
                <MenuIcon name="calendar" />
                <span className="v-label">My Events</span>
              </a>
              <button
                type="button"
                className="v-chevron"
                aria-expanded={eventsOpen}
                aria-label={eventsOpen ? "Fold My Events" : "Open My Events"}
                onClick={() => setFold("events", host)}
              >
                <MenuChevron />
              </button>
            </div>
            <div className="account-subnav">
              <a className="v-item" href={PORTAL_EVENTS} aria-current={pathname === PORTAL_EVENTS ? "page" : undefined} title="All">
                <MenuIcon name="list" />
                <span className="v-label">All</span>
              </a>
              <a className="v-item" href={PORTAL_EVENTS_NEW} aria-current={pathname.startsWith(PORTAL_EVENTS_NEW) ? "page" : undefined} title="New Event">
                <MenuIcon name="plus" />
                <span className="v-label">New Event</span>
              </a>
              {events.map((event) => {
                const onEvent = eventPath?.eventId === event.id;
                const eventOpen = isOpen(event.id, Boolean(onEvent));
                return (
                  <div key={event.id} className={eventOpen ? "account-fold open" : "account-fold"}>
                    <div className="account-fold-row">
                      <a
                        className="v-item"
                        href={portalEventSectionHref(event.id, "dashboard")}
                        aria-current={onEvent && eventPath?.section === "menu" ? "page" : undefined}
                        title={event.title}
                      >
                        <MenuIcon name="calendar" />
                        <span className="v-label">{event.title}</span>
                      </a>
                      <button
                        type="button"
                        className="v-chevron"
                        aria-expanded={eventOpen}
                        aria-label={eventOpen ? `Fold ${event.title}` : `Open ${event.title}`}
                        onClick={() => setFold(event.id, Boolean(onEvent))}
                      >
                        <MenuChevron />
                      </button>
                    </div>
                    <div className="account-subnav">
                      {EVENT_MENU_ITEMS.map((item) => (
                        <a
                          key={item.id}
                          className="v-item"
                          href={portalEventSectionHref(event.id, item.slug)}
                          aria-current={onEvent && eventPath?.section === item.id ? "page" : undefined}
                          title={item.label}
                        >
                          <MenuIcon name={EVENT_ICONS[item.id]} />
                          <span className="v-label">{item.label}</span>
                        </a>
                      ))}
                      <a
                        className="v-item"
                        href={portalDoorHref(event.id)}
                        aria-current={onEvent && eventPath?.section === "door" ? "page" : undefined}
                        title="Door"
                      >
                        <MenuIcon name="door" />
                        <span className="v-label">Door</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <a className="v-item" href="/account/host" aria-current={pathname === "/account/host" ? "page" : undefined} title="Become an Event Host">
            <MenuIcon name="calendar" />
            <span className="v-label">Become an Event Host</span>
          </a>
        )}
        <div
          className={communitiesOpen ? "account-fold open" : "account-fold"}
          onMouseEnter={(event) => pinMenuFlyout(event.currentTarget)}
          onMouseLeave={(event) => clearMenuFlyout(event.currentTarget)}
          onFocus={(event) => pinMenuFlyout(event.currentTarget)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) clearMenuFlyout(event.currentTarget);
          }}
        >
          <div className="account-fold-row">
            <a className="v-item" href="/account/communities" title="Communities">
              <MenuIcon name="flag" />
              <span className="v-label">Communities</span>
            </a>
            <button
              type="button"
              className="v-chevron"
              aria-expanded={communitiesOpen}
              aria-label={communitiesOpen ? "Fold Communities" : "Open Communities"}
              onClick={() => setFold("communities", true)}
            >
              <MenuChevron />
            </button>
          </div>
          <div className="account-subnav">
            <a
              className="v-item"
              href="/account/communities"
              aria-current={pathname === "/account/communities" ? "page" : undefined}
              title="All"
            >
              <MenuIcon name="list" />
              <span className="v-label">All</span>
            </a>
            <a
              className="v-item"
              href="/account/community"
              aria-current={pathname === "/account/community" ? "page" : undefined}
              title="New Community"
            >
              <MenuIcon name="plus" />
              <span className="v-label">New Community</span>
            </a>
            {communities.map((community) => (
              <a
                key={community.id}
                className="v-item"
                href={`/account/communities/${community.id}`}
                aria-current={pathname === `/account/communities/${community.id}` ? "page" : undefined}
                title={community.title}
              >
                <MenuIcon name="flag" />
                <span className="v-label">{community.title}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
