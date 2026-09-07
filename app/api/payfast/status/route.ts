import { NextResponse } from "next/server";
import { getPayFastStatus, getPayFastConfig, buildPayFastCheckout } from "@/lib/payfast";
import { getPublicSiteUrl } from "@/lib/site-url";

/** Public readiness check — no secrets. Used by Control Room & smoke tests. */
export async function GET() {
  const status = getPayFastStatus();
  const siteUrl = getPublicSiteUrl();
  const config = getPayFastConfig();

  let signatureSmoke: "ok" | "skipped" | "failed" = "skipped";
  let subscriptionSignatureSmoke: "ok" | "skipped" | "failed" = "skipped";
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
    try {
      const built = buildPayFastCheckout({
        config,
        amountRands: "19.99",
        itemName: "Venturo Membership",
        mPaymentId: "mem_smoke_test",
        returnUrl: `${siteUrl}/join/subscribe/return`,
        cancelUrl: `${siteUrl}/join/subscribe`,
        notifyUrl: `${siteUrl}${status.itnPath}`,
        subscription: { frequency: 3, cycles: 0, recurringAmountRands: "19.99" },
      });
      const fields = built.fields;
      subscriptionSignatureSmoke =
        fields.signature?.length === 32 &&
        fields.subscription_type === "1" &&
        fields.frequency === "3" &&
        fields.cycles === "0"
          ? "ok"
          : "failed";
    } catch {
      subscriptionSignatureSmoke = "failed";
    }
  }

  return NextResponse.json({
    ...status,
    siteUrl,
    itnUrl: `${siteUrl}${status.itnPath}`,
    signatureSmoke,
    subscriptionSignatureSmoke,
    goLiveChecklist: [
      "Merchant account approved by PayFast",
      "Recurring Billing enabled on the PayFast merchant",
      "PAYFAST_PASSPHRASE set (required for subscriptions)",
      "PAYFAST_ENV=live on Vercel Production",
      `ITN / notify URL set to ${siteUrl}${status.itnPath}`,
      "Paid ticket smoke test on a real event",
      "Membership subscribe smoke test at /join/subscribe",
    ],
  });
}
