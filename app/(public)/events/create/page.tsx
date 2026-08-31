import { CreateEventWizard } from "@/components/CreateEventWizard";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformFees } from "@/lib/events";
import { isStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CreateEventPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/events/create");

  const fees = await getPlatformFees();
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
    <main className="shell event-create-shell">
      <section className="section" style={{ paddingTop: 16 }}>
        <CreateEventWizard
          isStaff={isStaff(user.role)}
          hasPayout={Boolean(existingPayout)}
          existingPayout={existingPayout}
          commissionPct={fees.commissionPct}
          bookingFeeCents={fees.bookingFeeCents}
        />
      </section>
    </main>
  );
}
