import { headers } from "next/headers";
import { LandingDiscover } from "@/components/LandingDiscover";
import { LandingHeaderScrim } from "@/components/LandingHeaderScrim";
import { getCurrentUser } from "@/lib/auth";
import { getAppStoreLinks } from "@/lib/brand";
import { listingsByCategory, mixListingsByInterest } from "@/lib/listings";
import { loadHomeFeatures, loadWebsiteCopy } from "@/lib/website";

export default async function HomePage() {
  const [copy, features, user, listings, headerList] = await Promise.all([
    loadWebsiteCopy(),
    loadHomeFeatures(),
    getCurrentUser(),
    listingsByCategory("all"),
    headers(),
  ]);
  const stores = getAppStoreLinks();
  const android = /android/i.test(headerList.get("user-agent") ?? "");
  const appHref = android
    ? copy.playStoreUrl || stores.playStore
    : copy.appStoreUrl || stores.appStore;

  return (
    <>
      <LandingHeaderScrim />
      <LandingDiscover
        copy={copy}
        listings={mixListingsByInterest(listings, 8)}
        events={features.events.slice(0, 8)}
        communities={features.communities.slice(0, 8)}
        appHref={appHref}
        appLabel="Explore More In The App"
        showMemberPrice={user?.plan === "paid"}
      />
    </>
  );
}
