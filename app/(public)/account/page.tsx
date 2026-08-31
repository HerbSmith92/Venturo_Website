import { AccountNav } from "@/components/AccountNav";
import { ProfileForm } from "@/components/ProfileForm";
import { getCurrentUser } from "@/lib/auth";
import { PAID_PRICE } from "@/lib/brand";
import { loadMemberProfile, loadProfileCatalog, profileProgress } from "@/lib/profile";
import { redirect } from "next/navigation";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [profile, catalog] = await Promise.all([
    loadMemberProfile(user.id),
    loadProfileCatalog(),
  ]);
  const paid = user.plan === "paid";
  const firstName = profile.firstName.trim() || user.firstName;
  const formProfile = {
    ...profile,
    firstName,
  };
  const progress = profileProgress({
    firstName,
    avatarUrl: profile.avatarUrl,
    homePlaceId: profile.homePlaceId,
    personaIds: profile.personaIds,
    interestIds: profile.interestIds,
    energyLow: profile.energyLow,
    energyHigh: profile.energyHigh,
  });

  return (
    <main className="shell">
      <section className="section">
        <AccountNav current="profile" />
        <div className="profile-hero">
          <div className="profile-hero-avatar" aria-hidden>
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" />
            ) : (
              <span>{firstName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className="eyebrow">Your Profile</p>
            <h1>Hey {firstName}</h1>
            <p className="lede muted">{user.email}</p>
            <p className={`profile-status${progress.complete ? " complete" : ""}`}>
              {progress.complete
                ? "Profile complete. Ready for Made For You"
                : `${progress.doneCount} of ${progress.steps.length} profile bits filled in`}
            </p>
          </div>
        </div>

        <aside className={`plan-strip${paid ? " featured" : ""}`}>
          <div>
            <p className="eyebrow">Membership</p>
            <h2>{paid ? "Paid Member" : "Free Profile"}</h2>
            <p>
              {paid
                ? "RevenueCat confirmed your membership. Curated discovery & member ticket prices are on."
                : `Book tickets & host events for approval. Subscribe in the app for ${PAID_PRICE} a month for member prices.`}
            </p>
          </div>
          <div className="hero-actions">
            <a className="btn btn-secondary" href="/events">
              Browse Events
            </a>
            {!paid && (
              <a className="btn btn-secondary" href="/join#paid">
                Get Paid In The App
              </a>
            )}
          </div>
        </aside>
      </section>

      <section className="section">
        <p className="eyebrow">Same As The App</p>
        <h2>Shape Your Profile</h2>
        <p className="lede muted">
          {progress.complete
            ? "Edit anytime. These details power Made For You here & in the app."
            : "Photo, details, how you go out, interests & activity level—the same fields the app uses."}
        </p>
        <ProfileForm
          profile={formProfile}
          catalog={catalog}
          email={user.email ?? ""}
        />
      </section>
    </main>
  );
}
