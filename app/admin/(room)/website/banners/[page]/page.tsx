import { WebsitePageBannerManager } from "@/components/admin/WebsitePageBannerManager";
import { requireStaff } from "@/lib/auth";
import { isWebsiteBannerPage, WEBSITE_BANNER_PAGES } from "@/lib/website-banners";
import { loadWebsiteCopy } from "@/lib/website";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WebsiteBannerPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  await requireStaff();
  const { page } = await params;
  if (!isWebsiteBannerPage(page)) notFound();

  const copy = await loadWebsiteCopy();
  const imageUrl =
    page === "activities"
      ? copy.activitiesBanner.imageUrl
      : page === "events"
        ? copy.eventsBanner.imageUrl
        : copy.communitiesBanner.imageUrl;

  return (
    <WebsitePageBannerManager
      page={page}
      initialImageUrl={imageUrl || WEBSITE_BANNER_PAGES[page].defaultImage}
    />
  );
}
