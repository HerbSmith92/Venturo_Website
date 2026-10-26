import type { CurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";

export const HOST_MEMBERSHIP_REQUIRED = "Hosting needs a paid membership.";

/** Staff can host without a personal subscription. Everyone else needs Paid. */
export function canHost(user: Pick<CurrentUser, "plan" | "role">) {
  return isStaff(user.role) || user.plan === "paid";
}

export function hostSubscribeHref(next: string) {
  return `/join/subscribe?next=${encodeURIComponent(next)}`;
}
