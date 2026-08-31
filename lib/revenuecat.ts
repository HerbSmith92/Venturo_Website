import { ENTITLEMENT_ID } from "@/lib/brand";

export type Plan = "guest" | "free" | "paid";

type RevenueCatSubscriber = {
  subscriber?: {
    entitlements?: Record<
      string,
      {
        expires_date?: string | null;
        product_identifier?: string;
      }
    >;
  };
};

function entitlementIsActive(expiresDate?: string | null) {
  if (expiresDate === null || expiresDate === undefined) return true;
  return new Date(expiresDate).getTime() > Date.now();
}

export async function getPaidMembership(appUserId: string): Promise<boolean> {
  const secret = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secret || !appUserId) return false;

  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return false;

  const data = (await response.json()) as RevenueCatSubscriber;
  const entitlement = data.subscriber?.entitlements?.[ENTITLEMENT_ID];
  if (!entitlement) {
    const anyActive = Object.values(data.subscriber?.entitlements ?? {}).some((item) =>
      entitlementIsActive(item.expires_date),
    );
    return anyActive;
  }

  return entitlementIsActive(entitlement.expires_date);
}

/** Chunked paid checks for Control Room member lists. */
export async function getPaidMembershipMap(userIds: string[]) {
  const result = new Map<string, boolean>();
  const chunkSize = 10;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const flags = await Promise.all(chunk.map((id) => getPaidMembership(id)));
    chunk.forEach((id, index) => result.set(id, flags[index]));
  }
  return result;
}
