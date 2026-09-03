import { PricingPlans } from "@/components/PricingPlans";
import { getCurrentUser } from "@/lib/auth";
import { getAppStoreLinks, PAID_PRICE, revenueCatIsConfigured } from "@/lib/brand";
import { getPayFastStatus } from "@/lib/payfast";

export default async function JoinPage() {
  const user = await getCurrentUser();
  const stores = getAppStoreLinks();
  const rcReady = revenueCatIsConfigured();
  const payfast = getPayFastStatus();

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Join Venturo</p>
        <h1>Start Free. Go Paid When You&apos;re Ready.</h1>
        <p className="lede muted">
          Sign up with your email & a one-time code. Free lets you book event tickets & create
          events for review. Paid is {PAID_PRICE} a month — on the website via PayFast, or in the
          Venturo app via the App Store / Play Store once those listings are live.
        </p>
        <PricingPlans currentPlan={user?.plan ?? "guest"} />
      </section>
      <section className="section" id="paid">
        <h2>How Paid Gets Confirmed</h2>
        <ol>
          <li>Sign up free with your email & a one-time code on the website or in the app.</li>
          <li>
            Subscribe on the website with PayFast at {PAID_PRICE} / month, or in the app stores
            when the Venturo app is published.
          </li>
          <li>
            We unlock curated discovery & exclusive discounts when PayFast or RevenueCat says your
            membership is active.
          </li>
        </ol>
        <div className="hero-actions" style={{ marginTop: 24 }}>
          {user ? (
            user.plan === "paid" ? (
              <a className="btn btn-primary" href="/account">
                You Are a Paid Member
              </a>
            ) : (
              <a className="btn btn-primary" href="/join/subscribe">
                Subscribe With PayFast · {PAID_PRICE}
              </a>
            )
          ) : (
            <a className="btn btn-primary" href="/signup?next=/join/subscribe">
              Sign Up To Subscribe
            </a>
          )}
          {stores.appStoreReady ? (
            <a className="btn btn-secondary" href={stores.appStore}>
              App Store
            </a>
          ) : (
            <span className="btn btn-secondary" aria-disabled="true">
              App Store — Coming Soon
            </span>
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
        {!payfast.configured && (
          <p className="notice" style={{ marginTop: 16 }}>
            PayFast is not configured in this environment yet — website subscribe stays off until
            merchant keys are set.
          </p>
        )}
        {!rcReady && (
          <p className="muted" style={{ marginTop: 12 }}>
            RevenueCat secret is not set here — app-store paid status will not show until it is.
          </p>
        )}
        {(!stores.appStoreReady || !stores.playStoreReady) && (
          <p className="muted" style={{ marginTop: 12 }}>
            Store buttons light up when <code>NEXT_PUBLIC_APP_STORE_URL</code> &{" "}
            <code>NEXT_PUBLIC_PLAY_STORE_URL</code> point at live Venturo listings.
          </p>
        )}
      </section>
    </main>
  );
}
