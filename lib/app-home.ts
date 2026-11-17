import "server-only";

import {
  loadAutomaticHotCards,
  previewFilterCards,
  primaryItemKindForScreen,
  resolveAppHomeCards,
} from "@/lib/app-home-content";
import type {
  AppHomeAdmin,
  AppHomeBanner,
  AppHomeRow,
  AppHomeRowItem,
  AppHomeScreen,
} from "@/lib/app-home-types";
import { parseAppHomeSettings } from "@/lib/app-home-types";
import { createServiceClient } from "@/lib/supabase/admin";

export type {
  AppHomeAdmin,
  AppHomeBanner,
  AppHomeRow,
  AppHomeRowItem,
  AppHomeScreen,
} from "@/lib/app-home-types";
export { bannerLifecycleStatus, isAppHomeScreen, rowLifecycleStatus } from "@/lib/app-home-types";

export async function loadAppHomeAdmin(screen: AppHomeScreen): Promise<AppHomeAdmin> {
  const service = createServiceClient();
  if (!service) {
    return { screen, settings: {}, banners: [], rows: [] };
  }

  const [screenRow, banners, rows, items] = await Promise.all([
    service.from("app_home_screens").select("settings").eq("screen", screen).maybeSingle(),
    service
      .from("app_home_banners")
      .select("*")
      .eq("screen", screen)
      .neq("status", "archived")
      .order("sort_order")
      .order("created_at"),
    service
      .from("app_home_rows")
      .select("*")
      .eq("screen", screen)
      .neq("status", "archived")
      .order("sort_order")
      .order("created_at"),
    service.from("app_home_row_items").select("*").order("sort_order"),
  ]);

  const rowIds = new Set((rows.data ?? []).map((row) => row.id));
  const itemsByRow = new Map<string, AppHomeRowItem[]>();
  for (const item of (items.data ?? []) as AppHomeRowItem[]) {
    if (!rowIds.has(item.row_id)) continue;
    const list = itemsByRow.get(item.row_id) ?? [];
    list.push(item);
    itemsByRow.set(item.row_id, list);
  }

  return {
    screen,
    settings: (screenRow.data?.settings as Record<string, unknown> | null) ?? {},
    banners: (banners.data ?? []) as AppHomeBanner[],
    rows: ((rows.data ?? []) as Omit<AppHomeRow, "items">[]).map((row) => ({
      ...row,
      selection_rules: (row.selection_rules ?? {}) as Record<string, unknown>,
      items: itemsByRow.get(row.id) ?? [],
    })),
  };
}

function withinWindow(startsAt: string | null, endsAt: string | null, now: number) {
  if (startsAt) {
    const start = new Date(startsAt).getTime();
    if (!Number.isNaN(start) && start > now) return false;
  }
  if (endsAt) {
    const end = new Date(endsAt).getTime();
    if (!Number.isNaN(end) && end < now) return false;
  }
  return true;
}

export async function loadPublishedAppHome(screen: AppHomeScreen) {
  const admin = await loadAppHomeAdmin(screen);
  const settings = parseAppHomeSettings(admin.settings);
  const now = Date.now();
  const hidden = new Set(settings.hiddenSections);

  const banners = hidden.has("banners")
    ? []
    : admin.banners
        .filter(
          (banner) =>
            banner.status === "published" &&
            banner.is_active &&
            withinWindow(banner.starts_at, banner.ends_at, now),
        )
        .map((banner) => ({
          id: banner.id,
          title: banner.title,
          supportingText: banner.supporting_text,
          buttonLabel: banner.button_label,
          imageUrl: banner.image_path,
          focal: { x: Number(banner.focal_x), y: Number(banner.focal_y) },
          destination: {
            kind: banner.destination_kind,
            id: banner.destination_id,
            url: banner.destination_url,
          },
          sortOrder: banner.sort_order,
        }));

  const liveRows = admin.rows.filter(
    (row) =>
      row.status === "published" &&
      row.is_active &&
      withinWindow(row.starts_at, row.ends_at, now) &&
      !(row.row_kind === "hot" && hidden.has("hot")) &&
      !(row.row_kind === "featured" && hidden.has("featured")) &&
      !(row.row_kind === "custom" && hidden.has("custom")),
  );

  const rows = [];
  for (const row of liveRows) {
    const kind = primaryItemKindForScreen(screen);
    const maxItems = row.max_items || settings.defaultRowLimit;
    let cards =
      row.selection_mode === "automatic"
        ? await loadAutomaticHotCards(screen, row.selection_rules, maxItems)
        : row.selection_mode === "filter"
          ? await previewFilterCards({ screen, rules: row.selection_rules, maxItems })
          : await resolveAppHomeCards({
              kind,
              ids: [...row.items]
                .filter((item) => withinWindow(item.starts_at, item.ends_at, now))
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((item) => item.item_id),
            });

    cards = cards.filter((card) => card.available).slice(0, maxItems);
    if (!cards.length && settings.emptyBehaviour === "hide") continue;

    rows.push({
      id: row.id,
      kind: row.row_kind,
      title: row.public_title,
      description: row.public_description,
      selectionMode: row.selection_mode,
      selectionRules: row.selection_rules,
      maxItems,
      viewAll: {
        kind: row.view_all_kind,
        id: row.view_all_id,
        url: row.view_all_url,
      },
      sortOrder: row.sort_order,
      empty: cards.length === 0,
      items: cards.map((card, index) => ({
        id: card.id,
        kind: card.kind,
        title: card.title,
        subtitle: card.subtitle,
        imageUrl: card.imageUrl,
        meta: card.meta,
        sortOrder: index + 1,
      })),
    });
  }

  const orderRank = new Map(settings.sectionOrder.map((key, index) => [key, index]));
  rows.sort((a, b) => {
    const aKey = a.kind === "custom" ? "custom" : a.kind;
    const bKey = b.kind === "custom" ? "custom" : b.kind;
    const aOrder = orderRank.get(aKey) ?? 99;
    const bOrder = orderRank.get(bKey) ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.sortOrder - b.sortOrder;
  });

  return {
    screen,
    settings,
    banners,
    rows,
  };
}
