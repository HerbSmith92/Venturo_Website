"use client";

import Link from "next/link";
import { PUBLIC_CATEGORIES } from "@/lib/listing-categories";
import { SETTING_OPTIONS } from "@/lib/setting";
import { EVENT_ENERGY_SCALES } from "@/lib/event-types";

const PLACE_OPTIONS = [
  "Johannesburg",
  "Sandton",
  "Pretoria",
  "Centurion",
  "Midrand",
  "Soweto",
  "Randburg",
  "Roodepoort",
  "Fourways",
  "Parkhurst",
  "Melville",
  "Maboneng",
];

const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "0", label: "Free" },
  { value: "100", label: "Up to R100" },
  { value: "250", label: "Up to R250" },
  { value: "500", label: "Up to R500" },
  { value: "1000", label: "Up to R1 000" },
  { value: "2000", label: "Up to R2 000" },
];

function Icon({
  children,
  className = "discover-bar-icon",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function categoryIcon(id: string) {
  switch (id) {
    case "team":
      return (
        <Icon>
          <circle cx="9" cy="8" r="2.2" />
          <path d="M4.8 17c.5-2.2 2-3.3 4.2-3.3S12.7 14.8 13.2 17" />
          <circle cx="16" cy="8.2" r="1.9" />
          <path d="M15.2 13.8c1.5.2 2.7 1.1 3.2 3.2" />
        </Icon>
      );
    case "thrills":
      return (
        <Icon>
          <path d="M13 3 6.5 13h5L11 21l6.5-10h-5z" />
        </Icon>
      );
    case "adventure":
      return (
        <Icon>
          <path d="m4 18 5.5-9 3.2 5.2L15.5 10 20 18z" />
        </Icon>
      );
    case "romance":
      return (
        <Icon>
          <path d="M12 19s-6.5-4.1-6.5-8.2A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 6.5 2.8C18.5 14.9 12 19 12 19z" />
        </Icon>
      );
    case "family":
      return (
        <Icon>
          <circle cx="8.5" cy="8" r="2" />
          <circle cx="15.5" cy="8" r="2" />
          <circle cx="12" cy="11.5" r="1.6" />
          <path d="M4.8 18c.5-2 2-3 3.7-3h1.4c.6 0 1.1.1 1.6.4M14.5 15h1.4c1.7 0 3.2 1 3.7 3" />
        </Icon>
      );
    case "workshop":
      return (
        <Icon>
          <path d="M3 10.5 12 6l9 4.5-9 4.5z" />
          <path d="M7 13.2v3.3c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2v-3.3" />
          <path d="M21 11v5" />
        </Icon>
      );
    case "markets":
      return (
        <Icon>
          <path d="M5 10h14l-1 9H6z" />
          <path d="M4 10 7 5h10l3 5" />
          <path d="M10 14h4" />
        </Icon>
      );
    case "nightlife":
      return (
        <Icon>
          <path d="M8 3h5l1.8 8.5H6.2z" />
          <path d="M7 11.5h7v1.2a3.5 3.5 0 0 1-7 0z" />
          <path d="M10.5 3v1.5M16 8c1.4 0 2.5-1 2.5-2.2S17.4 3.5 16 3.5" />
        </Icon>
      );
    default:
      return null;
  }
}

export function DirectorySearch({
  q,
  place,
  price,
  sort,
  category,
  setting = "",
  level = "",
  lat,
  lng,
}: {
  q: string;
  place: string;
  price: string;
  sort: string;
  category: string;
  setting?: string;
  level?: string;
  lat?: string;
  lng?: string;
}) {
  const nearMe = Boolean(lat && lng);
  const filtered = Boolean(
    q ||
      place ||
      price ||
      setting ||
      level ||
      (category && category !== "all") ||
      nearMe ||
      (sort && sort !== "name" && sort !== ""),
  );

  const placeChoices = place && !PLACE_OPTIONS.includes(place) ? [place, ...PLACE_OPTIONS] : PLACE_OPTIONS;

  function categoryHref(id: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (place) params.set("place", place);
    if (price) params.set("price", price);
    if (sort) params.set("sort", sort);
    if (setting) params.set("setting", setting);
    if (level) params.set("level", level);
    if (lat) params.set("lat", lat);
    if (lng) params.set("lng", lng);
    if (id !== "all") params.set("category", id);
    const query = params.toString();
    return query ? `/directory?${query}` : "/directory";
  }

  function goNearMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const params = new URLSearchParams(window.location.search);
      params.set("lat", String(position.coords.latitude));
      params.set("lng", String(position.coords.longitude));
      params.set("sort", "distance");
      window.location.href = `/directory?${params.toString()}`;
    });
  }

  return (
    <section className="discover-bar" aria-label="Find activities">
      <div className="discover-bar-inner">
        <h2 className="discover-bar-title">Find your next adventure</h2>

        <form className="discover-bar-panel" action="/directory">
          {category && category !== "all" ? (
            <input type="hidden" name="category" value={category} />
          ) : null}
          {lat ? <input type="hidden" name="lat" value={lat} /> : null}
          {lng ? <input type="hidden" name="lng" value={lng} /> : null}

          <div className="discover-bar-row discover-bar-primary">
            <label className="discover-bar-field">
              <span>Keyword</span>
              <span className="discover-bar-control">
                <Icon>
                  <circle cx="11" cy="11" r="6" />
                  <path d="m16 16 3.5 3.5" />
                </Icon>
                <input
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Activities, events or places"
                  aria-label="Keyword"
                />
              </span>
            </label>

            <label className="discover-bar-field">
              <span>Location</span>
              <span className="discover-bar-control">
                <Icon>
                  <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z" />
                  <circle cx="12" cy="11" r="2.2" />
                </Icon>
                <select name="place" defaultValue={place} aria-label="Location">
                  <option value="">Choose an area</option>
                  {placeChoices.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="discover-bar-field">
              <span>Max price</span>
              <span className="discover-bar-control">
                <select name="price" defaultValue={price} aria-label="Maximum price">
                  {PRICE_OPTIONS.map((option) => (
                    <option key={option.value || "any"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="discover-bar-field">
              <span>Sort by</span>
              <span className="discover-bar-control">
                <select name="sort" defaultValue={sort || "name"} aria-label="Sort by">
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                  <option value="rating">Rating</option>
                  <option value="distance">Distance</option>
                </select>
              </span>
            </label>

            <button className="discover-bar-search btn" type="submit">
              <Icon className="discover-bar-icon discover-bar-icon-solid">
                <circle cx="11" cy="11" r="6" />
                <path d="m16 16 3.5 3.5" />
              </Icon>
              Search
            </button>
          </div>

          <div className="discover-bar-row discover-bar-secondary">
            <label className="discover-bar-field">
              <span>Setting</span>
              <span className="discover-bar-control">
                <Icon>
                  <path d="m4 18 5.5-9 3.2 5.2L15.5 10 20 18z" />
                </Icon>
                <select name="setting" defaultValue={setting} aria-label="Setting">
                  <option value="">Any setting</option>
                  {SETTING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="discover-bar-field">
              <span>Adventure level</span>
              <span className="discover-bar-control">
                <Icon>
                  <path d="M5 18V12M10 18V8M15 18v-6M20 18V6" />
                </Icon>
                <select name="level" defaultValue={level} aria-label="Adventure level">
                  <option value="">Any level</option>
                  {EVENT_ENERGY_SCALES.map((scale) => (
                    <option key={scale.rank} value={String(scale.rank)}>
                      {scale.rank}. {scale.title}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <div className="discover-bar-tools">
              <button
                className={`discover-bar-near${nearMe ? " is-on" : ""}`}
                type="button"
                onClick={goNearMe}
              >
                <Icon>
                  <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z" />
                  <circle cx="12" cy="11" r="2.2" />
                </Icon>
                Near me
              </button>
              <span className="discover-bar-divider" aria-hidden="true" />
              <a
                className={`discover-bar-clear${filtered ? "" : " is-muted"}`}
                href="/directory"
                aria-disabled={!filtered}
                tabIndex={filtered ? undefined : -1}
              >
                Clear filters
              </a>
            </div>
          </div>

          <div className="discover-bar-categories" role="list" aria-label="Categories">
            {PUBLIC_CATEGORIES.map((item) => {
              const active = category === item.id;
              return (
                <Link
                  key={item.id}
                  href={categoryHref(item.id)}
                  className={`discover-bar-chip${active ? " is-active" : ""}`}
                  role="listitem"
                  aria-current={active ? "true" : undefined}
                >
                  {item.id !== "all" ? categoryIcon(item.id) : null}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </form>
      </div>
    </section>
  );
}
