import { NextResponse } from "next/server";
import { getPayFastStatus, getPayFastConfig, buildPayFastCheckout } from "@/lib/payfast";
import { getPublicSiteUrl } from "@/lib/site-url";

/** Public readiness check — no secrets. Used by Control Room & smoke tests. */
export async function GET() {
  const status = getPayFastStatus();
  const siteUrl = getPublicSiteUrl();
  const config = getPayFastConfig();

  let signatureSmoke: "ok" | "skipped" | "failed" = "skipped";
  if (config) {
    try {
      const built = buildPayFastCheckout({
        config,
        amountRands: "1.00",
        itemName: "Venturo smoke test",
        mPaymentId: "smoke_test",
        returnUrl: `${siteUrl}/account/tickets`,
        cancelUrl: `${siteUrl}/events`,
        notifyUrl: `${siteUrl}${status.itnPath}`,
      });
      signatureSmoke = built.fields.signature?.length === 32 ? "ok" : "failed";
    } catch {
      signatureSmoke = "failed";
    }
  }

  return NextResponse.json({
    ...status,
    siteUrl,
    itnUrl: `${siteUrl}${status.itnPath}`,
    signatureSmoke,
    goLiveChecklist: [
      "Merchant account approved by PayFast",
      "PAYFAST_ENV=live on Vercel Production",
      `ITN / notify URL set to ${siteUrl}${status.itnPath}`,
      "Paid ticket smoke test on a real event",
    ],
  });
}
