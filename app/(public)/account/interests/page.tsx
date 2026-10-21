import { InterestsForm } from "@/components/profile/InterestsForm";
import { getCurrentUser } from "@/lib/auth";
import { loadMemberProfile, loadProfileCatalog } from "@/lib/profile";
import { redirect } from "next/navigation";

export default async function InterestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/interests");

  const [profile, catalog] = await Promise.all([
    loadMemberProfile(user.id),
    loadProfileCatalog(),
  ]);

  return (
    <>
      <p className="eyebrow">Interests</p>
      <h1>Activities You Enjoy</h1>
      <InterestsForm
        profile={{ ...profile, firstName: profile.firstName.trim() || user.firstName }}
        catalog={catalog}
      />
    </>
  );
}
