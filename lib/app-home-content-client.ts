import type { AppHomeScreen } from "@/lib/app-home-types";

export type AppHomeItemKind = "activity" | "event" | "community" | "guide";

export type AppHomeContentCard = {
  id: string;
  kind: AppHomeItemKind;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  meta: string | null;
  available: boolean;
};

export function primaryItemKindForScreen(screen: AppHomeScreen): AppHomeItemKind {
  if (screen === "events") return "event";
  if (screen === "community") return "community";
  return "activity";
}

export function automaticRuleOptions(screen: AppHomeScreen) {
  if (screen === "events") {
    return [
      { value: "upcoming", label: "Next upcoming events" },
      { value: "soonest_week", label: "Events starting in the next 7 days" },
    ];
  }
  if (screen === "community") {
    return [
      { value: "featured", label: "Featured communities" },
      { value: "recent", label: "Recently published communities" },
    ];
  }
  return [
    { value: "featured", label: "Featured (Top Pick) activities" },
    { value: "recent", label: "Recently updated live activities" },
  ];
}
