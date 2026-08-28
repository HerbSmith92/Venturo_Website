import { PricingPlans } from "@/components/PricingPlans";
import { getCurrentUser } from "@/lib/auth";
import { PAID_PRICE } from "@/lib/brand";

export default async function JoinPage() {
  const user = await getCurrentUser();
  const appStore = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "https://apps.apple.com";
  const playStore =
    process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "https://play.google.com/store";

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Join Venturo</p>
        <h1>Start Free. Go Paid In The App.</h1>
        <p className="lede muted">
          Free creates a profile so you can book event tickets. Paid is{" "}
          {PAID_PRICE} a month via the App Store or Play Store. This site asks
          RevenueCat whether your membership is active.
        </p>
        <PricingPlans currentPlan={user?.plan ?? "guest"} />
      </section>
      <section className="section" id="paid">
        <h2>How Paid Gets Confirmed</h2>
        <ol>
          <li>Sign up free on the website or in the app.</li>
          <li>Subscribe in the App Store or Play Store at {PAID_PRICE} / month.</li>
          <li>
            RevenueCat looks up your user & unlocks curated discovery plus
            exclusive discounts here and in the app.
          </li>
        </ol>
        <div className="hero-actions" style={{ marginTop: 24 }}>
          <a className="btn btn-primary" href={appStore}>
            App Store
          </a>
          <a className="btn btn-secondary" href={playStore}>
            Play Store
          </a>
        </div>
      </section>
    </main>
  );
}
