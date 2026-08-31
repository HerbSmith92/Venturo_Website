import { PricingPlans } from "@/components/PricingPlans";
import { getCurrentUser } from "@/lib/auth";
import { getAppStoreLinks, PAID_PRICE, revenueCatIsConfigured } from "@/lib/brand";

export default async function JoinPage() {
  const user = await getCurrentUser();
  const stores = getAppStoreLinks();
  const rcReady = revenueCatIsConfigured();

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Join Venturo</p>
        <h1>Start Free. Go Paid In The App.</h1>
        <p className="lede muted">
          Sign up with a password, then confirm with a one-time email code. Free
          lets you book event tickets & create events for review. Paid is{" "}
          {PAID_PRICE} a month via the App Store or Play Store. This site asks
          RevenueCat whether your membership is active.
        </p>
        <PricingPlans currentPlan={user?.plan ?? "guest"} />
      </section>
      <section className="section" id="paid">
        <h2>How Paid Gets Confirmed</h2>
        <ol>
          <li>Sign up free with a password & email code on the website or in the app.</li>
          <li>Subscribe in the App Store or Play Store at {PAID_PRICE} / month.</li>
          <li>
            RevenueCat looks up your user & unlocks curated discovery plus
            exclusive discounts here and in the app.
          </li>
        </ol>
        {!rcReady && (
          <p className="notice" style={{ marginTop: 16 }}>
            RevenueCat secret is not set in this environment — everyone stays on
            Free until it is.
          </p>
        )}
        <div className="hero-actions" style={{ marginTop: 24 }}>
          {stores.appStoreReady ? (
            <a className="btn btn-primary" href={stores.appStore}>
              App Store
            </a>
          ) : (
            <a className="btn btn-primary" href="/signup">
              Sign Up Free — App Store Link Soon
            </a>
          )}
          {stores.playStoreReady ? (
            <a className="btn btn-secondary" href={stores.playStore}>
              Play Store
            </a>
          ) : (
            <span className="btn btn-secondary" aria-disabled="true">
              Play Store — Coming Soon
            </span>
          )}
        </div>
        {(!stores.appStoreReady || !stores.playStoreReady) && (
          <p className="muted" style={{ marginTop: 12 }}>
            Set <code>NEXT_PUBLIC_APP_STORE_URL</code> &{" "}
            <code>NEXT_PUBLIC_PLAY_STORE_URL</code> on Vercel to the live listing
            URLs when the app is published.
          </p>
        )}
      </section>
    </main>
  );
}
