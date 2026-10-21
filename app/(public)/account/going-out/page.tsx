import { GoingOutForm } from "@/components/profile/GoingOutForm";
import { getCurrentUser } from "@/lib/auth";
import { loadMemberProfile, loadProfileCatalog } from "@/lib/profile";
import { redirect } from "next/navigation";

export default async function GoingOutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/going-out");

  const [profile, catalog] = await Promise.all([
    loadMemberProfile(user.id),
    loadProfileCatalog(),
  ]);

  return (
    <>
      <p className="eyebrow">Going Out</p>
      <h1>How You Usually Go Out</h1>
      <GoingOutForm
        profile={{ ...profile, firstName: profile.firstName.trim() || user.firstName }}
        catalog={catalog}
      />
    </>
  );
}
