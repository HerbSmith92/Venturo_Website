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
export const ENTITLEMENT_ID =
  process.env.REVENUECAT_ENTITLEMENT_ID ?? "subscription_monthly_1";
