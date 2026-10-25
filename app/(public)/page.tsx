import { headers } from "next/headers";
import { LandingDiscover } from "@/components/LandingDiscover";
import { LandingHeaderScrim } from "@/components/LandingHeaderScrim";
import { getCurrentUser } from "@/lib/auth";
import { getAppStoreLinks, storeUrlIsConfigured } from "@/lib/brand";
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
  const agent = headerList.get("user-agent") ?? "";
  const device = /android/i.test(agent) ? "android" : /iPhone|iPad|iPod/i.test(agent) ? "ios" : "desktop";
  const playCandidate = copy.playStoreUrl || stores.playStore;
  const playStoreHref = storeUrlIsConfigured(playCandidate, "android") ? playCandidate : null;

  return (
    <>
      <LandingHeaderScrim />
      <LandingDiscover
        copy={copy}
        listings={mixListingsByInterest(listings, 8)}
        events={features.events.slice(0, 8)}
        communities={features.communities.slice(0, 8)}
        appStoreHref={copy.appStoreUrl || stores.appStore}
        playStoreHref={playStoreHref}
        device={device}
        showMemberPrice={user?.plan === "paid"}
      />
    </>
  );
}
