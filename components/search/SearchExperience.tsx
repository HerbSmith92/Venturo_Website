"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SearchFiltersDrawer,
  type PendingFilters,
} from "@/components/search/SearchFiltersDrawer";
import { SEARCH_SCROLL_KEY, SearchResultCardView } from "@/components/search/SearchResultCard";
import {
  ADVENTURE_LEVELS,
  SETTING_OPTIONS,
  type IndoorOutdoorSetting,
  type SearchResponse,
  type SearchTab,
} from "@/components/search/types";

function parseSettings(raw: string | null): IndoorOutdoorSetting[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is IndoorOutdoorSetting =>
      item === "indoor" || item === "outdoor" || item === "both",
    );
}

function parseTab(raw: string | null): SearchTab {
  if (raw === "activities" || raw === "events" || raw === "communities") return raw;
  return "all";
}

function parseLevel(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function SearchExperience({ initial }: { initial: SearchResponse }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingNav, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(initial.applied.q);
  const [place, setPlace] = useState(initial.applied.place);
  const [pending, setPending] = useState<PendingFilters>({
    settings: initial.applied.settings,
    levelMin: initial.applied.levelMin,
    levelMax: initial.applied.levelMax,
  });

  const tab = parseTab(searchParams.get("tab"));
  const appliedSettings = parseSettings(searchParams.get("setting"));
  const appliedMin = parseLevel(searchParams.get("levelMin"));
  const appliedMax = parseLevel(searchParams.get("levelMax"));
  const audienceHint =
    searchParams.get("audience") === "women" || searchParams.get("audience") === "men"
      ? searchParams.get("audience")
      : null;

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
    setPlace(searchParams.get("place") ?? "");
    setPending({
      settings: parseSettings(searchParams.get("setting")),
      levelMin: parseLevel(searchParams.get("levelMin")),
      levelMax: parseLevel(searchParams.get("levelMax")),
    });
  }, [searchParams]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SEARCH_SCROLL_KEY);
      if (saved) {
        const y = Number(saved);
        if (Number.isFinite(y)) window.scrollTo(0, y);
        sessionStorage.removeItem(SEARCH_SCROLL_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const chips = useMemo(() => {
    const items: { key: string; label: string; clear: () => void }[] = [];
    for (const setting of appliedSettings) {
      const label = SETTING_OPTIONS.find((item) => item.value === setting)?.label ?? setting;
      items.push({
        key: `setting-${setting}`,
        label,
        clear: () => updateUrl({ setting: appliedSettings.filter((item) => item !== setting) }),
      });
    }
    if (appliedMin != null || appliedMax != null) {
      const min = appliedMin ?? 1;
      const max = appliedMax ?? 5;
      const label =
        min === max
          ? ADVENTURE_LEVELS.find((item) => item.rank === min)?.title ?? `Level ${min}`
          : `Level ${min}–${max}`;
      items.push({
        key: "level",
        label,
        clear: () => updateUrl({ levelMin: null, levelMax: null }),
      });
    }
    if (audienceHint) {
      items.push({
        key: "audience",
        label: audienceHint === "women" ? "For Women" : "For Men",
        clear: () => updateUrl({ audience: null }),
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSettings, appliedMin, appliedMax, audienceHint]);

  function updateUrl(patch: {
    q?: string | null;
    place?: string | null;
    tab?: SearchTab | null;
    setting?: IndoorOutdoorSetting[] | null;
    levelMin?: number | null;
    levelMax?: number | null;
    audience?: string | null;
    page?: number | null;
    lat?: string | null;
    lng?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string | null | undefined) => {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    };

    if ("q" in patch) setOrDelete("q", patch.q);
    if ("place" in patch) setOrDelete("place", patch.place);
    if ("tab" in patch) setOrDelete("tab", patch.tab === "all" || !patch.tab ? null : patch.tab);
    if ("setting" in patch) {
      setOrDelete("setting", patch.setting?.length ? patch.setting.join(",") : null);
    }
    if ("levelMin" in patch) setOrDelete("levelMin", patch.levelMin == null ? null : String(patch.levelMin));
    if ("levelMax" in patch) setOrDelete("levelMax", patch.levelMax == null ? null : String(patch.levelMax));
    if ("audience" in patch) setOrDelete("audience", patch.audience);
    if ("page" in patch) setOrDelete("page", !patch.page || patch.page <= 1 ? null : String(patch.page));
    if ("lat" in patch) setOrDelete("lat", patch.lat);
    if ("lng" in patch) setOrDelete("lng", patch.lng);

    const next = params.toString();
    setError(null);
    startTransition(() => {
      router.push(next ? `${pathname}?${next}` : pathname, { scroll: false });
    });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    updateUrl({ q, place, page: 1 });
  }

  function applyFilters() {
    updateUrl({
      setting: pending.settings,
      levelMin: pending.levelMin,
      levelMax: pending.levelMax,
      page: 1,
    });
    setFiltersOpen(false);
  }

  function clearFilters() {
    setPending({ settings: [], levelMin: null, levelMax: null });
    updateUrl({ setting: [], levelMin: null, levelMax: null, page: 1 });
    setFiltersOpen(false);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateUrl({
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
          place: place || "Near me",
          page: 1,
        });
      },
      () => setError("Could not read your location."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  const tabs: { id: SearchTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: initial.counts.total },
    { id: "activities", label: "Activities", count: initial.counts.activities },
    { id: "events", label: "Events", count: initial.counts.events },
    { id: "communities", label: "Communities", count: initial.counts.communities },
  ];

  return (
    <div className="search-page">
      <header className="search-hero">
        <div className="shell search-hero-inner">
          <p className="eyebrow">Search</p>
          <h1>Find your next adventure</h1>
          <form className="search-form" onSubmit={submitSearch}>
            <label className="search-field">
              <span className="sr-only">Search</span>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Try hiking, markets, or a community name"
              />
            </label>
            <label className="search-field search-field-place">
              <span className="sr-only">Place</span>
              <input
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                placeholder="Area or city"
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pendingNav}>
              Search
            </button>
            <button className="btn btn-ghost" type="button" onClick={useMyLocation}>
              {searchParams.get("lat") ? "Update location" : "Use my location"}
            </button>
          </form>
          {searchParams.get("lat") ? (
            <p className="search-location-note">
              Sorting nearer first ·{" "}
              <button type="button" className="linkish" onClick={() => updateUrl({ lat: null, lng: null })}>
                Clear location
              </button>
            </p>
          ) : null}
        </div>
      </header>

      <div className="shell search-body">
        <div className="search-toolbar">
          <div className="search-tabs" role="tablist" aria-label="Result type">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`chip${tab === item.id ? " active" : ""}`}
                onClick={() => updateUrl({ tab: item.id, page: 1 })}
              >
                {item.label}
                {tab === "all" || tab === item.id ? ` (${item.count})` : ""}
              </button>
            ))}
          </div>
          <div className="search-quick">
            {SETTING_OPTIONS.map((option) => {
              const on = appliedSettings.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`chip${on ? " active" : ""}`}
                  aria-pressed={on}
                  onClick={() => {
                    const next = on
                      ? appliedSettings.filter((item) => item !== option.value)
                      : [...appliedSettings, option.value];
                    updateUrl({ setting: next, page: 1 });
                  }}
                >
                  {option.label}
                </button>
              );
            })}
            <button type="button" className="btn btn-secondary" onClick={() => setFiltersOpen(true)}>
              Filters
            </button>
          </div>
        </div>

        {chips.length ? (
          <div className="search-chip-row search-applied">
            {chips.map((chip) => (
              <button key={chip.key} type="button" className="chip active" onClick={chip.clear}>
                {chip.label} ×
              </button>
            ))}
          </div>
        ) : null}

        <p className="search-count">
          {pendingNav
            ? "Updating…"
            : `${initial.counts.total} result${initial.counts.total === 1 ? "" : "s"}`}
        </p>

        {error ? <p className="error">{error}</p> : null}

        {!pendingNav && !initial.results.length ? (
          <div className="search-empty">
            <h2>Nothing matched</h2>
            <p>Try a broader place, clear a filter, or search a different word.</p>
            <button type="button" className="btn btn-secondary" onClick={clearFilters}>
              Clear setting &amp; adventure filters
            </button>
          </div>
        ) : (
          <div className="search-results">
            {initial.results.map((item) => (
              <SearchResultCardView key={`${item.kind}-${item.id}-${item.startsAt ?? ""}`} item={item} />
            ))}
          </div>
        )}

        {initial.pageCount > 1 ? (
          <nav className="search-pagination" aria-label="Pages">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={initial.page <= 1 || pendingNav}
              onClick={() => updateUrl({ page: initial.page - 1 })}
            >
              Previous
            </button>
            <span>
              Page {initial.page} of {initial.pageCount}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={initial.page >= initial.pageCount || pendingNav}
              onClick={() => updateUrl({ page: initial.page + 1 })}
            >
              Next
            </button>
          </nav>
        ) : null}
      </div>

      <SearchFiltersDrawer
        open={filtersOpen}
        pending={pending}
        onChange={setPending}
        onClose={() => setFiltersOpen(false)}
        onApply={applyFilters}
        onClear={clearFilters}
        resultCount={initial.counts.total}
      />
    </div>
  );
}
