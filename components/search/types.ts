export type SearchTab = "all" | "activities" | "events" | "communities";

export type SearchResultKind = "activity" | "event" | "community";

export type IndoorOutdoorSetting = "indoor" | "outdoor" | "both";

export type ContentAudience = "all" | "women" | "men";

export type SearchResultCard = {
  kind: SearchResultKind;
  id: string;
  slug: string;
  href: string;
  title: string;
  image: string | null;
  location: string | null;
  setting: IndoorOutdoorSetting | null;
  settingLabel: string | null;
  adventureLabel: string | null;
  startsAt: string | null;
  timezone: string | null;
  audience: ContentAudience;
  kicker: string;
};

export type SearchResponse = {
  results: SearchResultCard[];
  counts: {
    total: number;
    activities: number;
    events: number;
    communities: number;
  };
  page: number;
  pageSize: number;
  pageCount: number;
  tab: SearchTab;
  applied: {
    q: string;
    place: string;
    lat: string | null;
    lng: string | null;
    settings: IndoorOutdoorSetting[];
    levelMin: number | null;
    levelMax: number | null;
    audienceHint: ContentAudience | null;
  };
};

export function formatEventWhen(startsAt: string, timezone = "Africa/Johannesburg") {
  if (!startsAt) return "Date coming";
  try {
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(startsAt));
  } catch {
    return startsAt;
  }
}

export const SETTING_OPTIONS: { value: IndoorOutdoorSetting; label: string }[] = [
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
  { value: "both", label: "Indoor & Outdoor" },
];

export const ADVENTURE_LEVELS = [
  { rank: 1, title: "Chilled Hang" },
  { rank: 2, title: "Low Key Adventure" },
  { rank: 3, title: "Up & Active" },
  { rank: 4, title: "Adrenaline Tease" },
  { rank: 5, title: "Full Throttle" },
] as const;
