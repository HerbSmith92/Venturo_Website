import { headers } from "next/headers";
import { LandingDiscover } from "@/components/LandingDiscover";
import { LandingHeaderScrim } from "@/components/LandingHeaderScrim";
import { getCurrentUser } from "@/lib/auth";
import { getAppStoreLinks, storeUrlIsConfigured } from "@/lib/brand";
import { mixListingsByInterest } from "@/lib/listings";
import { loadHomeFeatures, loadWebsiteCopy } from "@/lib/website";

export default async function HomePage() {
  const [copy, features, user, headerList] = await Promise.all([
    loadWebsiteCopy(),
    loadHomeFeatures(),
    getCurrentUser(),
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
        listings={mixListingsByInterest(features.listings, 8)}
        events={features.events.slice(0, 8)}
        communities={features.communities.slice(0, 8)}
        guides={features.guides.slice(0, 8)}
        appStoreHref={copy.appStoreUrl || stores.appStore}
        playStoreHref={playStoreHref}
        device={device}
        showMemberPrice={user?.plan === "paid"}
        signedIn={Boolean(user)}
        firstName={user?.firstName ?? ""}
      />
    </>
  );
}
