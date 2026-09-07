import { ENTITLEMENT_ID } from "@/lib/brand";

export type Plan = "guest" | "free" | "paid";

export type PaidMembershipDetail = {
  active: boolean;
  expiresAt: string | null;
};

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

function pickEntitlement(data: RevenueCatSubscriber) {
  const entitlements = data.subscriber?.entitlements ?? {};
  const named = entitlements[ENTITLEMENT_ID];
  if (named) return named;
  return Object.values(entitlements).find((item) => entitlementIsActive(item.expires_date));
}

/** Live RevenueCat API — writers/backfill only. Privileges read `member_access`. */
export async function getPaidMembershipDetail(
  appUserId: string,
): Promise<PaidMembershipDetail> {
  const secret = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secret || !appUserId) return { active: false, expiresAt: null };

  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return { active: false, expiresAt: null };

  const data = (await response.json()) as RevenueCatSubscriber;
  const entitlement = pickEntitlement(data);
  if (!entitlement) return { active: false, expiresAt: null };

  const expiresAt = entitlement.expires_date ?? null;
  return { active: entitlementIsActive(expiresAt), expiresAt };
}

export async function getPaidMembership(appUserId: string): Promise<boolean> {
  const detail = await getPaidMembershipDetail(appUserId);
  return detail.active;
}

/** Chunked paid checks for one-shot backfill. */
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
