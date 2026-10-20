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
          Curated discovery & exclusive discounts stay with Paid.
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
          <li>Same membership on the website & the app</li>
        </ul>
        <p className="muted">Pay here, or keep a store subscription in the app.</p>
        <a className="btn btn-primary" href={currentPlan === "paid" ? "/account" : "/join/subscribe"}>
          {currentPlan === "paid" ? "You Are a Paid Member" : `Subscribe · ${PAID_PRICE} / month`}
        </a>
      </article>
    </div>
  );
}
