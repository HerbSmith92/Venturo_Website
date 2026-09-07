import { HostSettings, type HostSettingsTab } from "@/components/portal/HostSettings";
import { getCurrentUser } from "@/lib/auth";
import { defaultOrganiserProfile, loadOrganiserProfile } from "@/lib/host-profile";
import { loadMemberProfile } from "@/lib/profile";
import { PORTAL_LOGIN } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PortalSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(PORTAL_LOGIN);

  const { tab: tabRaw } = await searchParams;
  const tab: HostSettingsTab = tabRaw === "bank" ? "bank" : "details";
  const profile = await loadMemberProfile(user.id);
  const firstName = profile.firstName || (user.firstName !== "there" ? user.firstName : "");
  const lastName = profile.lastName;
  const email = user.email ?? "";
  const hostProfile = defaultOrganiserProfile(
    firstName,
    lastName,
    email,
    await loadOrganiserProfile(user.id),
  );

  const supabase = await createClient();
  let existingPayout: {
    accountHolder: string;
    bankName: string;
    accountNumberLast4: string;
    branchCode: string | null;
  } | null = null;

  if (supabase) {
    const { data } = await supabase
      .from("organiser_payout_profiles")
      .select("account_holder, bank_name, account_number_last4, branch_code")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      existingPayout = {
        accountHolder: data.account_holder,
        bankName: data.bank_name,
        accountNumberLast4: data.account_number_last4,
        branchCode: data.branch_code,
      };
    }
  }

  return (
    <main className="portal-studio">
      <HostSettings
        tab={tab}
        firstName={firstName}
        lastName={lastName}
        email={email}
        hostProfile={hostProfile}
        existingPayout={existingPayout}
      />
    </main>
  );
}
