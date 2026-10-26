export type VeeLook = {
  src: string;
  accent: string;
  ink: "snow" | "night";
};

const night = "night" as const;
const snow = "snow" as const;

export function personaLook(title: string): VeeLook {
  const name = title.toLowerCase();
  if (name.includes("solo")) return { src: "/brand/vee/solo.png", accent: "var(--sapphire)", ink: night };
  if (name.includes("partner")) return { src: "/brand/vee/partner.png", accent: "var(--pomegranate)", ink: snow };
  if (name.includes("family")) return { src: "/brand/vee/with-family.png", accent: "var(--blush)", ink: night };
  if (name.includes("friend")) return { src: "/brand/vee/friends.png", accent: "var(--canary)", ink: night };
  if (name.includes("meeting") || name.includes("new people")) {
    return { src: "/brand/vee/meeting.png", accent: "var(--velvet)", ink: snow };
  }
  if (name.includes("visit")) return { src: "/brand/vee/visiting.png", accent: "var(--jade)", ink: night };
  if (name.includes("work")) return { src: "/brand/vee/workplace.png", accent: "var(--orange)", ink: night };
  return { src: "/brand/vee/adventure.png", accent: "var(--canary)", ink: night };
}

export const HUB_ORDER = [
  "adventure",
  "thrills",
  "romance",
  "family",
  "nightlife",
  "team",
  "workshop",
  "markets",
  "digital",
  "third-party",
];

const HUBS: Record<string, VeeLook> = {
  adventure: { src: "/brand/vee/adventure.png", accent: "var(--jade)", ink: night },
  thrills: { src: "/brand/vee/thrills.png", accent: "var(--orange)", ink: night },
  romance: { src: "/brand/vee/romance.png", accent: "var(--pomegranate)", ink: snow },
  family: { src: "/brand/vee/family.png", accent: "var(--blush)", ink: night },
  nightlife: { src: "/brand/vee/nightlife.png", accent: "var(--velvet)", ink: snow },
  team: { src: "/brand/vee/team.png", accent: "var(--canary)", ink: night },
  workshop: { src: "/brand/vee/workshop.png", accent: "var(--magenta)", ink: night },
  markets: { src: "/brand/vee/markets.png", accent: "var(--maroon)", ink: snow },
  digital: { src: "/brand/vee/games.png", accent: "var(--sapphire)", ink: night },
  "third-party": { src: "/brand/vee/shows.png", accent: "var(--maroon)", ink: snow },
};

export function hubLook(key: string): VeeLook {
  return HUBS[key] ?? { src: "/brand/vee/adventure.png", accent: "var(--canary)", ink: night };
}
