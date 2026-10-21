import { ActivityForm } from "@/components/profile/ActivityForm";
import { getCurrentUser } from "@/lib/auth";
import { loadMemberProfile, loadProfileCatalog } from "@/lib/profile";
import { redirect } from "next/navigation";

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/activity");

  const [profile, catalog] = await Promise.all([
    loadMemberProfile(user.id),
    loadProfileCatalog(),
  ]);

  return (
    <>
      <p className="eyebrow">Activity Level</p>
      <h1>How Active You Feel</h1>
      <ActivityForm
        profile={{ ...profile, firstName: profile.firstName.trim() || user.firstName }}
        catalog={catalog}
      />
    </>
  );
}
