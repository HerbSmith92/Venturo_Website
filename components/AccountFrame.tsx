"use client";

import { useEffect, useState } from "react";
import { AccountNav } from "@/components/AccountNav";
import { usePathname } from "next/navigation";

const NAV_KEY = "venturo-account-nav";

export function AccountFrame({
  host,
  events = [],
  communities = [],
  children,
}: {
  host: boolean;
  events?: { id: string; title: string }[];
  communities?: { id: string; title: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(NAV_KEY) === "collapsed") setCollapsed(true);
  }, []);

  if (pathname.startsWith("/account/reset-password")) return children;

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(NAV_KEY, next ? "collapsed" : "open");
      return next;
    });
  }

  return (
    <div className="shell">
      <section className={collapsed ? "section account-frame is-collapsed" : "section account-frame"}>
        <AccountNav
          host={host}
          events={events}
          communities={communities}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <div className="account-main">{children}</div>
      </section>
    </div>
  );
}
