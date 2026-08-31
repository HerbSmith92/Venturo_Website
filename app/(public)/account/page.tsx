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
        <div className="profile-greeting">
          <p className="eyebrow">Your Profile</p>
          <h1>Hey {firstName}</h1>
          <p className="lede muted">{user.email}</p>
          <p className={`profile-status${progress.complete ? " complete" : ""}`}>
            {progress.complete
              ? "Profile complete. Ready for Made For You"
              : `${progress.doneCount} of ${progress.steps.length} profile bits filled in`}
          </p>
        </div>
        <p className="eyebrow" style={{ marginTop: 28 }}>
          Same As The App
        </p>
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
          paid={paid}
          paidPrice={PAID_PRICE}
        />
      </section>
    </main>
  );
}
