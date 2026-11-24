"use client";

import Link from "next/link";
import { formatEventWhen, type SearchResultCard as Card } from "@/components/search/types";

export const SEARCH_SCROLL_KEY = "venturo-search-scroll";

export function SearchResultCardView({ item }: { item: Card }) {
  const kindLabel =
    item.kind === "activity" ? "Activity" : item.kind === "event" ? "Event" : "Community";

  return (
    <Link
      className="search-card"
      href={item.href}
      onClick={() => {
        try {
          sessionStorage.setItem(SEARCH_SCROLL_KEY, String(window.scrollY));
        } catch {
          /* ignore */
        }
      }}
    >
      <div className="search-card-image">
        {item.image ? <img src={item.image} alt="" /> : <span className="search-card-fallback" />}
        <span className="search-card-kind">{kindLabel}</span>
      </div>
      <div className="search-card-body">
        <p className="search-card-kicker">{item.kicker}</p>
        <h3>{item.title}</h3>
        {item.kind === "event" && item.startsAt ? (
          <p className="search-card-meta">
            {formatEventWhen(item.startsAt, item.timezone ?? "Africa/Johannesburg")}
          </p>
        ) : null}
        {item.location ? <p className="search-card-meta">{item.location}</p> : null}
        <p className="search-card-tags">
          {item.settingLabel ? <span>{item.settingLabel}</span> : null}
          {item.adventureLabel ? <span>{item.adventureLabel}</span> : null}
        </p>
      </div>
    </Link>
  );
}
