import { AnalyticsKeysGuide } from "@/components/admin/AnalyticsKeysGuide";
import { CatalogEditor } from "@/components/admin/CatalogEditor";
import { getStaffSession } from "@/lib/auth";
import { loadCatalogAdmin } from "@/lib/catalog-admin";
import { getPlatformFees } from "@/lib/events";
import { getPaystackStatus } from "@/lib/paystack";
import {
  getAppStoreLinks,
  revenueCatIsConfigured,
  revenueCatWebhookIsConfigured,
} from "@/lib/brand";
import {
  androidApiConfigured,
  iosApiConfigured,
  revenueCatChartsConfigured,
} from "@/lib/analytics-remote";
import { isAdmin } from "@/lib/roles";
import { getPublicSiteUrl } from "@/lib/site-url";

export default async function AdminSettingsPage() {
  const session = await getStaffSession();
  const canManage = isAdmin(session?.role);
  const [fees, paystack, catalog] = await Promise.all([
    getPlatformFees(),
    Promise.resolve(getPaystackStatus()),
    loadCatalogAdmin(),
  ]);
  const siteUrl = getPublicSiteUrl();
  const stores = getAppStoreLinks();
  const rcReady = revenueCatIsConfigured();
  const rcWebhookReady = revenueCatWebhookIsConfigured();

  return (
    <section className="cr-paper">
      <p className="eyebrow">Ops</p>
      <h1>Settings</h1>
      <p className="muted">
        Payments, membership access, & ticket platform fees. Keep fees at R 0.00
        until rates are locked.
      </p>

      <article className="plan" style={{ marginTop: 28 }}>
        <p className="eyebrow">Paystack</p>
        <h2>Ticket Checkout</h2>
        <ul>
          <li>
            Status:{" "}
            <strong>
              {paystack.configured
                ? paystack.mode === "live"
                  ? "Live"
                  : paystack.mode === "test"
                    ? "Test"
                    : "Key set"
                : "Not configured"}
            </strong>
          </li>
          {paystack.secretMasked && <li>Secret: {paystack.secretMasked}</li>}
          <li>
            Membership plan:{" "}
            <strong>{paystack.planCode ?? "Created on the first subscribe"}</strong>
          </li>
          <li>
            Webhook URL (paste in the Paystack dashboard):{" "}
            <code>
              {siteUrl}
              {paystack.webhookPath}
            </code>
          </li>
        </ul>
        <p className="muted" style={{ marginTop: 12 }}>
          Test mode is the right place to build. When Paystack approves the business, swap{" "}
          <code>PAYSTACK_SECRET_KEY</code> for the live secret on Vercel Production & set the live
          webhook to the URL above.
        </p>
      </article>

      <article className="plan" style={{ marginTop: 20 }}>
        <p className="eyebrow">Membership</p>
        <h2>Access Table, RevenueCat & Stores</h2>
        <ul>
          <li>
            Website Paid check: <strong>member_access.subscribed</strong> (not a live store call)
          </li>
          <li>
            RevenueCat webhook auth:{" "}
            <strong>{rcWebhookReady ? "Configured" : "Missing REVENUECAT_WEBHOOK_AUTH"}</strong>
          </li>
          <li>
            Webhook URL (paste in RevenueCat):{" "}
            <code>
              {siteUrl}
              /api/revenuecat/webhook
            </code>
          </li>
          <li>
            RevenueCat API (backfill + Analytics):{" "}
            <strong>
              {rcReady
                ? revenueCatChartsConfigured()
                  ? "Configured"
                  : "Secret set — add REVENUECAT_PROJECT_ID for charts"
                : "Missing secret key"}
            </strong>
          </li>
          <li>
            App Store Connect downloads:{" "}
            <strong>{iosApiConfigured() ? "Ready" : "Missing Team API key / vendor number"}</strong>
          </li>
          <li>
            Play Console downloads:{" "}
            <strong>
              {androidApiConfigured() ? "Ready" : "Missing reports bucket / service account"}
            </strong>
          </li>
          <li>
            App Store link:{" "}
            <strong>{stores.appStoreReady ? "Ready" : "Placeholder — set NEXT_PUBLIC_APP_STORE_URL"}</strong>
          </li>
          <li>
            Play Store link:{" "}
            <strong>
              {stores.playStoreReady ? "Ready" : "Placeholder — set NEXT_PUBLIC_PLAY_STORE_URL"}
            </strong>
          </li>
        </ul>
        <p className="muted" style={{ marginTop: 12 }}>
          Paystack takes ticket payments & website membership. RevenueCat still writes app-store
          membership into <code>member_access</code>. The website & app only read <code>subscribed</code>.
          Store buttons stay soft until real listing URLs are in Vercel env.
        </p>
      </article>

      <AnalyticsKeysGuide className="plan" />

      <article className="plan" style={{ marginTop: 20 }}>
        <p className="eyebrow">Platform fees</p>
        <h2>Ticket fees</h2>
        <p className="muted">
          Commission {fees.commissionPct}% · booking fee R {(fees.bookingFeeCents / 100).toFixed(2)} ·
          member discount {fees.memberDiscountPct}%.
        </p>
        <p style={{ marginTop: 12 }}>
          <a className="btn btn-secondary" href="/admin/fees">
            Open ticket fees
          </a>
        </p>
      </article>

      {canManage && (
        <article className="plan" style={{ marginTop: 20 }}>
          <p className="eyebrow">Sign-Up Lists</p>
          <h2>How You Go Out & Activities</h2>
          <p className="muted">
            Add, hide, or rewrite the chips people tap during onboarding. Hidden items stay on
            existing profiles.
          </p>
          <CatalogEditor catalog={catalog} />
        </article>
      )}
    </section>
  );
}
