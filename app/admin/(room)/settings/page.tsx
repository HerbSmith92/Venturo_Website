import { CatalogEditor } from "@/components/admin/CatalogEditor";
import { FeeSettingsForm } from "@/components/admin/FeeSettingsForm";
import { getStaffSession } from "@/lib/auth";
import { loadCatalogAdmin } from "@/lib/catalog-admin";
import { getPlatformFees } from "@/lib/events";
import { getPayFastStatus } from "@/lib/payfast";
import {
  getAppStoreLinks,
  revenueCatIsConfigured,
  revenueCatWebhookIsConfigured,
} from "@/lib/brand";
import { isAdmin } from "@/lib/roles";
import { getPublicSiteUrl } from "@/lib/site-url";

export default async function AdminSettingsPage() {
  const session = await getStaffSession();
  const canManage = isAdmin(session?.role);
  const [fees, payfast, catalog] = await Promise.all([
    getPlatformFees(),
    Promise.resolve(getPayFastStatus()),
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
        <p className="eyebrow">PayFast</p>
        <h2>Ticket Checkout</h2>
        <ul>
          <li>
            Status:{" "}
            <strong>
              {payfast.configured
                ? payfast.mode === "live"
                  ? "Live"
                  : "Sandbox"
                : "Not configured"}
            </strong>
          </li>
          {payfast.merchantIdMasked && (
            <li>Merchant ID: {payfast.merchantIdMasked}</li>
          )}
          <li>
            ITN URL (paste in PayFast dashboard):{" "}
            <code>
              {siteUrl}
              {payfast.itnPath}
            </code>
          </li>
        </ul>
        <p className="muted" style={{ marginTop: 12 }}>
          Go-live: merchant approved → set <code>PAYFAST_ENV=live</code> on Vercel
          Production → ITN URL above → smoke-test a paid ticket. Sandbox is fine
          until then.
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
            RevenueCat API (backfill only):{" "}
            <strong>{rcReady ? "Configured" : "Missing secret key"}</strong>
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
          PayFast ITNs & RevenueCat webhooks write <code>member_access</code>. The website & app
          only read <code>subscribed</code>. Store buttons stay soft until real listing URLs are
          in Vercel env.
        </p>
      </article>

      <article className="plan" style={{ marginTop: 20 }}>
        <p className="eyebrow">Platform Fees</p>
        <h2>Event Ticket Take</h2>
        <FeeSettingsForm
          commissionPct={fees.commissionPct}
          bookingFeeCents={fees.bookingFeeCents}
        />
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
