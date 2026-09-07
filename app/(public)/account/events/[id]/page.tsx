import { EventStudio } from "@/components/events/EventStudio";
import { getCurrentUser } from "@/lib/auth";
import { getEventById, getPlatformFees } from "@/lib/events";
import { isStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function EventStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/events");

  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  if (event.organiserId !== user.id && !isStaff(user.role)) notFound();

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
        <p className="muted" style={{ marginBottom: 12 }}>
          <a href="/account/events">← Events</a>
        </p>
        <EventStudio
          event={event}
          isStaff={isStaff(user.role)}
          hasPayout={Boolean(existingPayout)}
          commissionPct={fees.commissionPct}
          bookingFeeCents={fees.bookingFeeCents}
        />
      </section>
    </main>
  );
}
