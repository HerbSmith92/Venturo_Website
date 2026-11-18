export type WebsiteBannerPage = "activities" | "events" | "communities";

export const WEBSITE_BANNER_PAGES: Record<
  WebsiteBannerPage,
  {
    label: string;
    publicPath: string;
    imageColumn:
      | "activities_banner_image_url"
      | "events_banner_image_url"
      | "communities_banner_image_url";
    defaultImage: string;
  }
> = {
  activities: {
    label: "Activities",
    publicPath: "/directory",
    imageColumn: "activities_banner_image_url",
    defaultImage: "/brand/landing/next-adventure.jpg",
  },
  events: {
    label: "Events",
    publicPath: "/events",
    imageColumn: "events_banner_image_url",
    defaultImage: "",
  },
  communities: {
    label: "Communities",
    publicPath: "/communities",
    imageColumn: "communities_banner_image_url",
    defaultImage: "/brand/landing/find-your-kind-of-fun.png",
  },
};

export function isWebsiteBannerPage(value: string): value is WebsiteBannerPage {
  return value === "activities" || value === "events" || value === "communities";
}
