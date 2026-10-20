import { NextResponse } from "next/server";
import { getPaystackStatus } from "@/lib/paystack";
import { getPublicSiteUrl } from "@/lib/site-url";

/** Public readiness check — no secrets. */
export async function GET() {
  const status = getPaystackStatus();
  const siteUrl = getPublicSiteUrl();
  return NextResponse.json({
    provider: "paystack",
    ...status,
    siteUrl,
    webhookUrl: `${siteUrl}${status.webhookPath}`,
    goLiveChecklist: [
      "Paystack business approved",
      "PAYSTACK_SECRET_KEY swapped to the live secret on Vercel Production",
      `Live webhook URL set to ${siteUrl}${status.webhookPath}`,
      "PAYSTACK_PLAN_CODE set if the live plan should not be created on first subscribe",
      "Paid ticket smoke test on a real event",
      "Membership subscribe smoke test at /join/subscribe",
    ],
  });
}
