export const COLORS = {
  snowDrift: "#EBEBF3",
  nightSky: "#2A2D35",
  pomegranate: "#D54732",
  orange: "#FF9E6B",
  pink: "#FF2EFF",
  canary: "#F3BF4A",
  blackCurrant: "#14001A",
  maroon: "#971A21",
  sapphire: "#7CC3E9",
  blush: "#DC729E",
  velvet: "#5E589E",
  jade: "#45A67F",
} as const;

export const PAID_PRICE = "R 19.99";
export const PAID_CADENCE = "per month";
/** PayFast amount string (ZAR, 2 decimals). Keep in sync with PAID_PRICE. */
export const PAID_AMOUNT_RANDS = "19.99";
export const PAID_AMOUNT_CENTS = 1999;
export const ENTITLEMENT_ID =
  process.env.REVENUECAT_ENTITLEMENT_ID ?? "subscription_monthly_1";

const GENERIC_APP_STORE = "https://apps.apple.com";
const GENERIC_PLAY_STORE = "https://play.google.com/store";

/** True when env still points at the store front door, not a Venturo listing. */
export function storeUrlIsConfigured(url: string | undefined, kind: "ios" | "android") {
  if (!url?.trim()) return false;
  const trimmed = url.trim();
  if (kind === "ios") {
    return (
      trimmed !== GENERIC_APP_STORE &&
      /apps\.apple\.com\/.+id\d+/i.test(trimmed)
    );
  }
  return (
    trimmed !== GENERIC_PLAY_STORE &&
    /play\.google\.com\/store\/apps\/details/i.test(trimmed)
  );
}

export function getAppStoreLinks() {
  const appStore = process.env.NEXT_PUBLIC_APP_STORE_URL ?? GENERIC_APP_STORE;
  const playStore = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? GENERIC_PLAY_STORE;
  return {
    appStore,
    playStore,
    appStoreReady: storeUrlIsConfigured(appStore, "ios"),
    playStoreReady: storeUrlIsConfigured(playStore, "android"),
  };
}

export function revenueCatIsConfigured() {
  return Boolean(process.env.REVENUECAT_SECRET_API_KEY?.trim());
}
