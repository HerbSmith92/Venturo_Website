import { FeeSettingsForm } from "@/components/admin/FeeSettingsForm";
import { getPlatformFees } from "@/lib/events";
import { getPayFastStatus } from "@/lib/payfast";
import { getAppStoreLinks, revenueCatIsConfigured } from "@/lib/brand";
import { getPublicSiteUrl } from "@/lib/site-url";

export default async function AdminSettingsPage() {
  const [fees, payfast] = await Promise.all([getPlatformFees(), Promise.resolve(getPayFastStatus())]);
  const siteUrl = getPublicSiteUrl();
  const stores = getAppStoreLinks();
  const rcReady = revenueCatIsConfigured();

  return (
    <section className="cr-paper">
      <p className="eyebrow">Ops</p>
      <h1>Settings</h1>
      <p className="muted">
        Payments, membership checks, & ticket platform fees. Keep fees at R 0.00
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
        <h2>RevenueCat & Stores</h2>
        <ul>
          <li>
            RevenueCat API: <strong>{rcReady ? "Configured" : "Missing secret key"}</strong>
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
          Paid is confirmed only via RevenueCat. Join page store buttons stay soft
          until real listing URLs are in Vercel env.
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
    </section>
  );
}
