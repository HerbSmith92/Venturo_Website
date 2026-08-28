import { getCurrentUser } from "@/lib/auth";
import { PAID_PRICE } from "@/lib/brand";
import { redirect } from "next/navigation";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const paid = user.plan === "paid";

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Your Profile</p>
        <h1>Hey {user.firstName}</h1>
        <p className="lede muted">{user.email}</p>
        <article className={paid ? "plan featured" : "plan"}>
          <h2>{paid ? "Paid Member" : "Free Profile"}</h2>
          {paid ? (
            <p>
              RevenueCat confirmed your membership. Curated discovery & exclusive
              discounts are on.
            </p>
          ) : (
            <p>
              You can book event tickets. Subscribe in the app for {PAID_PRICE} a
              month to unlock member benefits.
            </p>
          )}
          <div className="hero-actions" style={{ marginTop: 20 }}>
            <a className="btn btn-primary" href="/directory">
              Back To Directory
            </a>
            {!paid && (
              <a className="btn btn-secondary" href="/join#paid">
                Get Paid In The App
              </a>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
