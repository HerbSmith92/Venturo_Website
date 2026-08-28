import { PAID_CADENCE, PAID_PRICE } from "@/lib/brand";

export function PricingPlans({
  currentPlan,
}: {
  currentPlan?: "free" | "paid" | "guest";
}) {
  return (
    <div className="plans">
      <article className="plan">
        <p className="eyebrow" style={{ color: "var(--sapphire)" }}>
          Free
        </p>
        <h2>Create a Profile</h2>
        <p className="muted">R 0 · forever</p>
        <ul>
          <li>Browse the directory taste</li>
          <li>Book tickets to events</li>
          <li>Keep a simple profile</li>
        </ul>
        <p className="muted">
          No subscriber benefits — curated discovery & exclusive discounts stay
          with Paid.
        </p>
        <a className="btn btn-secondary" href="/signup">
          {currentPlan === "free" ? "Your Current Plan" : "Sign Up Free"}
        </a>
      </article>
      <article className="plan featured">
        <p className="eyebrow" style={{ color: "var(--canary)" }}>
          Paid
        </p>
        <h2>Venturo Membership</h2>
        <p>
          {PAID_PRICE} {PAID_CADENCE}
        </p>
        <ul>
          <li>Curated discovery & personal recommendations</li>
          <li>Exclusive member discounts</li>
          <li>Confirmed by RevenueCat after App Store or Play Store payment</li>
        </ul>
        <p className="muted">
          Membership is billed in the Venturo app. This website checks RevenueCat
          to unlock paid benefits.
        </p>
        <a className="btn btn-primary" href="/join#paid">
          {currentPlan === "paid" ? "You Are a Paid Member" : "Get Paid In The App"}
        </a>
      </article>
    </div>
  );
}
