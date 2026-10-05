"use client";

import { createListing } from "@/app/admin/actions";
import { createCommunity } from "@/app/admin/content-actions";
import type { StaffSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_KEY = "venturo-control-nav";

const ROW_ITEMS = ["Banner", "Hot on Venturo", "Featured", "+ Add Row Listing", "Settings"];

type Leaf = {
  id: string;
  label: string;
  href?: string;
  action?: "create-listing" | "create-community" | "sign-out";
};

type Heading = {
  id: string;
  label: string;
  href?: string;
  action?: "sign-out";
  leaves: Leaf[];
};

type Group = {
  id: string;
  label?: string;
  labelHref?: string;
  headings: Heading[];
};

function planned(group: string, screen: string) {
  const params = new URLSearchParams({ group, screen });
  return `/admin/planned?${params.toString()}`;
}

function rowLeaves(group: string): Leaf[] {
  return ROW_ITEMS.map((label) => ({
    id: `${group}-${label}`,
    label,
    href: planned(group, label),
  }));
}

function menu(admin: boolean, name: string): Group[] {
  return [
    {
      id: "overview",
      label: "Overview",
      labelHref: "/admin",
      headings: [],
    },
    {
      id: "content",
      label: "Content",
      headings: [
        {
          id: "directory",
          label: "Directory",
          href: "/admin/listings?status=approved",
          leaves: [
            { id: "approved", label: "All Live", href: "/admin/listings?status=approved" },
            ...(admin ? [{ id: "add-listing", label: "+ Add New Listing", action: "create-listing" as const }] : []),
            { id: "review", label: "New Listings Requested", href: "/admin/listings?status=review" },
            { id: "draft", label: "Changes Requested", href: "/admin/listings?status=draft" },
            { id: "scheduled", label: "Scheduled", href: "/admin/listings?status=scheduled" },
            { id: "archived", label: "Archived", href: "/admin/listings?status=archived" },
            { id: "suspended", label: "Suspended", href: "/admin/listings?status=suspended" },
          ],
        },
        {
          id: "content-events",
          label: "Events",
          href: "/admin/events?status=review",
          leaves: [
            { id: "review", label: "In Review", href: "/admin/events?status=review" },
            { id: "approved", label: "Live", href: "/admin/events?status=approved" },
            { id: "draft", label: "Drafts", href: "/admin/events?status=draft" },
            { id: "rejected", label: "Rejected", href: "/admin/events?status=rejected" },
            { id: "cancelled", label: "Cancelled", href: "/admin/events?status=cancelled" },
            { id: "archived", label: "Archived", href: "/admin/events?status=archived" },
            { id: "all", label: "All", href: "/admin/events?status=all" },
          ],
        },
        {
          id: "community",
          label: "Communities",
          href: "/admin/communities",
          leaves: [
            { id: "all", label: "All", href: "/admin/communities" },
            { id: "add-community", label: "+ Add new Community", action: "create-community" },
            { id: "requested", label: "Requested", href: "/admin/communities?status=requested" },
            { id: "changes", label: "Changes Requested", href: "/admin/communities?status=draft" },
            { id: "archived", label: "Archived", href: "/admin/communities?status=archived" },
            { id: "suspended", label: "Suspended", href: "/admin/communities?status=suspended" },
          ],
        },
        {
          id: "guides",
          label: "Guides",
          href: "/admin/guides",
          leaves: [
            { id: "all", label: "All", href: "/admin/guides" },
            { id: "draft", label: "Drafts", href: "/admin/guides?status=draft" },
            { id: "published", label: "Published", href: "/admin/guides?status=published" },
            { id: "archived", label: "Archived", href: "/admin/guides?status=archived" },
          ],
        },
      ],
    },
    {
      id: "application",
      label: "Application View",
      headings: [
        {
          id: "app-discover",
          label: "Discover",
          href: planned("Application View", "Discover"),
          leaves: rowLeaves("Discover"),
        },
        {
          id: "app-events",
          label: "Events",
          href: planned("Application View", "Events"),
          leaves: rowLeaves("Events"),
        },
        {
          id: "app-community",
          label: "Community",
          href: planned("Application View", "Community"),
          leaves: rowLeaves("Community"),
        },
        {
          id: "app-wallet",
          label: "Wallet",
          href: planned("Application View", "Wallet"),
          leaves: [
            { id: "token", label: "Token Image", href: planned("Wallet", "Token Image") },
            { id: "achievements", label: "Achievements", href: planned("Wallet", "Achievements") },
          ],
        },
      ],
    },
    {
      id: "onboarding",
      label: "Onboarding",
      headings: [
        { id: "interests", label: "Interests", href: planned("Onboarding", "Interests"), leaves: [] },
        { id: "how-you-go-out", label: "How You Go Out", href: planned("Onboarding", "How You Go Out"), leaves: [] },
        { id: "adventure-level", label: "Adventure Level", href: planned("Onboarding", "Adventure Level"), leaves: [] },
        { id: "bucket-list", label: "Bucket List", href: planned("Onboarding", "Bucket List"), leaves: [] },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      headings: [
        { id: "analytics", label: "Analytics", href: "/admin/analytics", leaves: [] },
        { id: "members", label: "Members", href: "/admin/members", leaves: [] },
        { id: "legal", label: "Legal", href: planned("Settings", "Legal"), leaves: [] },
      ],
    },
    {
      id: "user",
      label: "User",
      headings: [
        { id: "account", label: name || "Account", href: planned("User", "Account"), leaves: [] },
        ...(admin ? [{ id: "add-users", label: "+ Add Users", href: "/admin/staff", leaves: [] }] : []),
        { id: "sign-out", label: "Log Out", action: "sign-out" as const, leaves: [] },
      ],
    },
    {
      id: "public-site",
      label: "Public Site",
      labelHref: "/",
      headings: [],
    },
  ];
}

function headingMatches(heading: Heading, path: string, here: string) {
  if (heading.id === "overview") return path === "/admin";
  if (heading.id === "directory") return path.startsWith("/admin/listings");
  if (heading.id === "content-events") return path.startsWith("/admin/events");
  if (heading.id === "community") return path.startsWith("/admin/communities");
  if (heading.id === "guides") return path.startsWith("/admin/guides");
  if (heading.id === "analytics") return path.startsWith("/admin/analytics");
  if (heading.id === "members") return path.startsWith("/admin/members");
  if (heading.id === "add-users") return path.startsWith("/admin/staff");
  if (path === "/admin/planned") {
    if (heading.href === here) return true;
    return heading.leaves.some((leaf) => leaf.href === here);
  }
  return false;
}

export function AdminNav({ user }: { user: StaffSession }) {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const admin = isAdmin(user.role);
  const groups = menu(admin, user.firstName);
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (window.localStorage.getItem(NAV_KEY) === "collapsed") setCollapsed(true);
  }, []);

  const here = leafActive(path, params);
  const activeHeading = groups
    .flatMap((group) => group.headings)
    .find((heading) => headingMatches(heading, path, here));

  function isOpen(id: string) {
    if (id in open) return open[id];
    return activeHeading?.id === id;
  }

  function toggleHeading(heading: Heading) {
    if (heading.leaves.length === 0) {
      if (heading.href) router.push(heading.href);
      return;
    }
    const next = !isOpen(heading.id);
    setOpen((current) => ({ ...current, [heading.id]: next }));
    if (next && heading.href) router.push(heading.href);
  }

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(NAV_KEY, next ? "collapsed" : "open");
      return next;
    });
  }

  return (
    <aside className={collapsed ? "cr-nav is-collapsed" : "cr-nav"}>
      <div className="cr-brand">
        <button
          type="button"
          className="cr-nav-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand menu" : "Minimise menu"}
          onClick={toggleCollapsed}
        >
          <span className="cr-nav-chevron" aria-hidden="true" />
        </button>
        <a href="/admin" aria-label="Control Room home">
          <img src="/brand/logos/venturo-horizontal-light.svg" alt="Venturo" />
        </a>
        <span>Control Room</span>
      </div>
      <nav className="cr-nav-body" aria-label="Control Room">
        {groups.map((group) => (
          <div key={group.id} className="cr-nav-group">
            {group.label ? (
              group.labelHref ? (
                <a className={group.id === "overview" && path === "/admin" ? "cr-nav-label active" : "cr-nav-label"} href={group.labelHref}>
                  {group.label}
                </a>
              ) : (
                <p className="cr-nav-label">{group.label}</p>
              )
            ) : null}
            {group.headings.map((heading) => (
              <HeadingRow
                key={heading.id}
                heading={heading}
                open={heading.leaves.length > 0 && isOpen(heading.id)}
                path={path}
                here={here}
                onToggle={() => toggleHeading(heading)}
              />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function HeadingRow({
  heading,
  open,
  path,
  here,
  onToggle,
}: {
  heading: Heading;
  open: boolean;
  path: string;
  here: string;
  onToggle: () => void;
}) {
  const active = headingMatches(heading, path, here) || heading.leaves.some((leaf) => leaf.href === here);

  if (heading.action === "sign-out") {
    return (
      <form action="/auth/sign-out" method="post">
        <input type="hidden" name="next" value="/admin/login" />
        <button className="cr-leaf" type="submit">
          Log Out
        </button>
      </form>
    );
  }

  return (
    <div className={open ? "cr-section open" : "cr-section"}>
      <button type="button" className={active ? "cr-heading active" : "cr-heading"} aria-expanded={heading.leaves.length > 0 ? open : undefined} onClick={onToggle}>
        <span>{heading.label}</span>
        {heading.leaves.length > 0 ? <span className="cr-heading-caret" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="cr-subnav">
          {heading.leaves.map((leaf) =>
            leaf.action === "create-listing" ? (
              <form key={leaf.id} action={createListing}>
                <button type="submit">{leaf.label}</button>
              </form>
            ) : leaf.action === "create-community" ? (
              <form key={leaf.id} action={createCommunity}>
                <button type="submit">{leaf.label}</button>
              </form>
            ) : (
              <a key={leaf.id} className={leaf.href === here ? "active" : undefined} href={leaf.href}>
                {leaf.label}
              </a>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function leafActive(path: string, params: { get(name: string): string | null }) {
  if (path === "/admin/planned") {
    const screen = params.get("screen") ?? "";
    const group = params.get("group") ?? "";
    return planned(group, screen);
  }
  const status = params.get("status");
  if (path === "/admin/listings") return `/admin/listings?status=${status || "approved"}`;
  if (path === "/admin/events") return `/admin/events?status=${status || "review"}`;
  if (path === "/admin/communities") return status && status !== "all" ? `/admin/communities?status=${status}` : "/admin/communities";
  if (path === "/admin/guides") return status ? `/admin/guides?status=${status}` : "/admin/guides";
  return path;
}
