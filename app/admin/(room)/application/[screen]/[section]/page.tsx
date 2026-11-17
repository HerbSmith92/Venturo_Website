import { AppHomeBannerManager } from "@/components/admin/AppHomeBannerManager";
import { AppHomeRowManager } from "@/components/admin/AppHomeRowManager";
import { AppHomeSettingsManager } from "@/components/admin/AppHomeSettingsManager";
import { requireAdmin } from "@/lib/auth";
import { isAppHomeScreen, loadAppHomeAdmin } from "@/lib/app-home";
import { loadCatalogAdmin } from "@/lib/catalog-admin";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const SECTIONS = new Set([
  "banner",
  "hot-on-venturo",
  "featured",
  "add-row-listing",
  "settings",
]);

export default async function ApplicationSectionPage({
  params,
}: {
  params: Promise<{ screen: string; section: string }>;
}) {
  await requireAdmin();
  const { screen, section } = await params;
  if (!isAppHomeScreen(screen) || !SECTIONS.has(section)) notFound();

  const initial = await loadAppHomeAdmin(screen);

  if (section === "banner") {
    return <AppHomeBannerManager screen={screen} initial={initial} />;
  }

  if (section === "settings") {
    return <AppHomeSettingsManager screen={screen} initial={initial} />;
  }

  if (section === "hot-on-venturo") {
    return <AppHomeRowManager screen={screen} mode="hot" initial={initial} />;
  }

  if (section === "featured") {
    return <AppHomeRowManager screen={screen} mode="featured" initial={initial} />;
  }

  const catalog = await loadCatalogAdmin();
  return (
    <AppHomeRowManager
      screen={screen}
      mode="custom"
      initial={initial}
      interests={catalog.interests.map((item) => ({ id: item.id, title: item.title }))}
    />
  );
}
