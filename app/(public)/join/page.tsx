import { PricingPlans } from "@/components/PricingPlans";
import { getCurrentUser } from "@/lib/auth";
import { PAID_PRICE } from "@/lib/brand";

export default async function JoinPage() {
  const user = await getCurrentUser();

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Join Venturo</p>
        <h1>Start Free. Go Paid When You&apos;re Ready.</h1>
        <p className="lede muted">
          Sign up with your email & a one-time code. Free lets you book event tickets & create
          events for review. Paid is {PAID_PRICE} a month on the website, or in the app.
        </p>
        <PricingPlans currentPlan={user?.plan ?? "guest"} />
      </section>
      <section className="section" id="paid">
        <h2>How Paid Gets Confirmed</h2>
        <ol>
          <li>Sign up free with your email & a one-time code on the website or in the app.</li>
          <li>Subscribe on the website at {PAID_PRICE} / month. The app can use the stores too.</li>
          <li>We unlock curated discovery & exclusive discounts when your membership is active.</li>
        </ol>
        <div className="hero-actions" style={{ marginTop: 24 }}>
          {user?.plan === "paid" ? (
            <a className="btn btn-primary" href="/account">
              You Are a Paid Member
            </a>
          ) : (
            <a className="btn btn-primary" href="/join/subscribe">
              Subscribe · {PAID_PRICE} / month
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
