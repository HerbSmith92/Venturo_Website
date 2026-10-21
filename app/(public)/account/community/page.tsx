import { RegisterCommunityForm } from "@/components/profile/RegisterCommunityForm";
import { getCurrentUser } from "@/lib/auth";
import { loadMemberProfile, loadProfileCatalog } from "@/lib/profile";
import { redirect } from "next/navigation";

export default async function RegisterCommunityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/community");

  const [profile, catalog] = await Promise.all([
    loadMemberProfile(user.id),
    loadProfileCatalog(),
  ]);
  const firstName = profile.firstName.trim() || (user.firstName !== "there" ? user.firstName : "");

  return (
    <>
      <p className="eyebrow">Community</p>
      <h1>Register a Community</h1>
      <p className="lede muted">
        Community Details, Founder Details, then Contact &amp; Socials. Submit adds it under Communities.
      </p>
      <RegisterCommunityForm
        founderName={[firstName, profile.lastName].filter(Boolean).join(" ")}
        founderEmail={user.email ?? ""}
        contactEmail={user.email ?? ""}
        phone={profile.phone}
        initialArea={catalog.places.find((place) => place.id === profile.homePlaceId)?.name ?? ""}
      />
    </>
  );
}
