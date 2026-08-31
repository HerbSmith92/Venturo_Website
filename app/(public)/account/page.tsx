import { AccountNav } from "@/components/AccountNav";
import { ProfileForm } from "@/components/ProfileForm";
import { getCurrentUser } from "@/lib/auth";
import { PAID_PRICE } from "@/lib/brand";
import { loadMemberProfile, loadProfileCatalog } from "@/lib/profile";
import { redirect } from "next/navigation";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [profile, catalog] = await Promise.all([
    loadMemberProfile(user.id),
    loadProfileCatalog(),
  ]);
  const paid = user.plan === "paid";
  const greeting = profile.displayName || user.firstName;

  return (
    <main className="shell">
      <section className="section">
        <AccountNav current="profile" />
        <p className="eyebrow">Your Profile</p>
        <h1>Hey {greeting}</h1>
        <p className="lede muted">{user.email}</p>
        <article className={paid ? "plan featured" : "plan"}>
          <h2>{paid ? "Paid Member" : "Free Profile"}</h2>
          {paid ? (
            <p>
              RevenueCat confirmed your membership. Curated discovery & exclusive
              discounts — including event tickets — are on.
            </p>
          ) : (
            <p>
              You can book event tickets & host events for approval. Subscribe in
              the app for {PAID_PRICE} a month to unlock member ticket prices.
            </p>
          )}
          <div className="hero-actions" style={{ marginTop: 20 }}>
            <a className="btn btn-secondary" href="/events">
              Browse Events
            </a>
            <a className="btn btn-secondary" href="/directory">
              Directory
            </a>
            {!paid && (
              <a className="btn btn-secondary" href="/join#paid">
                Get Paid In The App
              </a>
            )}
          </div>
        </article>
      </section>

      <section className="section">
        <p className="eyebrow">Same As The App</p>
        <h2>Name, Place, Interests</h2>
        <p className="lede muted">
          {profile.onboardingStep === "complete"
            ? "Edit anytime. These tags power Made For You here & in the app."
            : "Finish this so Made For You can meet you. Skip is allowed — you can come back."}
        </p>
        <ProfileForm profile={profile} catalog={catalog} />
      </section>
    </main>
  );
}
