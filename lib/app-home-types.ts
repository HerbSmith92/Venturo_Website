import {
  scheduleStatus,
  type ScheduleStatus,
} from "@/lib/control-room-schedule";

export type AppHomeScreen = "discover" | "events" | "community";

export type AppHomeBanner = {
  id: string;
  screen: AppHomeScreen;
  admin_name: string;
  title: string | null;
  supporting_text: string | null;
  button_label: string | null;
  image_path: string | null;
  focal_x: number;
  focal_y: number;
  destination_kind: string | null;
  destination_id: string | null;
  destination_url: string | null;
  sort_order: number;
  status: "draft" | "published" | "archived";
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  updated_at: string;
};

export type AppHomeRowItem = {
  id: string;
  row_id: string;
  item_kind: "activity" | "event" | "community" | "guide";
  item_id: string;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type AppHomeRow = {
  id: string;
  screen: AppHomeScreen;
  row_kind: "hot" | "featured" | "custom";
  admin_name: string;
  public_title: string | null;
  public_description: string | null;
  selection_mode: "manual" | "automatic" | "filter";
  selection_rules: Record<string, unknown>;
  max_items: number;
  view_all_kind: string | null;
  view_all_id: string | null;
  view_all_url: string | null;
  sort_order: number;
  status: "draft" | "published" | "archived";
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  updated_at: string;
  items: AppHomeRowItem[];
};

export type AppHomeAdmin = {
  screen: AppHomeScreen;
  settings: Record<string, unknown>;
  banners: AppHomeBanner[];
  rows: AppHomeRow[];
};

export function isAppHomeScreen(value: string): value is AppHomeScreen {
  return value === "discover" || value === "events" || value === "community";
}

export function bannerLifecycleStatus(banner: AppHomeBanner): ScheduleStatus {
  return scheduleStatus({
    isActive: banner.is_active,
    startsAt: banner.starts_at,
    endsAt: banner.ends_at,
    isPublished: banner.status === "published",
  });
}

export function rowLifecycleStatus(row: Pick<AppHomeRow, "is_active" | "starts_at" | "ends_at" | "status">): ScheduleStatus {
  return scheduleStatus({
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isPublished: row.status === "published",
  });
}

export type AppHomeScreenSettings = {
  sectionOrder: string[];
  hiddenSections: string[];
  defaultRowLimit: number;
  emptyBehaviour: "hide" | "placeholder";
};

export const DEFAULT_APP_HOME_SETTINGS: AppHomeScreenSettings = {
  sectionOrder: ["banners", "hot", "featured", "custom"],
  hiddenSections: [],
  defaultRowLimit: 12,
  emptyBehaviour: "hide",
};

export function parseAppHomeSettings(raw: Record<string, unknown> | null | undefined): AppHomeScreenSettings {
  const sectionOrder = Array.isArray(raw?.sectionOrder)
    ? raw.sectionOrder.map(String)
    : DEFAULT_APP_HOME_SETTINGS.sectionOrder;
  const hiddenSections = Array.isArray(raw?.hiddenSections)
    ? raw.hiddenSections.map(String)
    : [];
  const defaultRowLimit = Number(raw?.defaultRowLimit);
  const emptyBehaviour = raw?.emptyBehaviour === "placeholder" ? "placeholder" : "hide";
  return {
    sectionOrder: sectionOrder.length ? sectionOrder : DEFAULT_APP_HOME_SETTINGS.sectionOrder,
    hiddenSections,
    defaultRowLimit:
      Number.isFinite(defaultRowLimit) && defaultRowLimit > 0
        ? Math.min(24, Math.trunc(defaultRowLimit))
        : DEFAULT_APP_HOME_SETTINGS.defaultRowLimit,
    emptyBehaviour,
  };
}
