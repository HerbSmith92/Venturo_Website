import { EventChrome } from "@/components/portal/EventChrome";
import { EventPayment } from "@/components/portal/EventPayment";
import { requirePortalEvent } from "@/lib/event-access";
import { getEventPayoutSummary } from "@/lib/event-payouts";
import { createClient } from "@/lib/supabase/server";

export default async function PortalPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event, user } = await requirePortalEvent(id, "editor");
  const summary = await getEventPayoutSummary(id);
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
      .eq("user_id", event.organiserId)
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
      <EventChrome event={event} current="payment">
        <EventPayment
          event={event}
          summary={summary}
          existingPayout={existingPayout}
          hostEmail={user.email ?? ""}
          fallbackHolder={user.firstName}
          canEditBank={event.organiserId === user.id}
        />
      </EventChrome>
    </main>
  );
}
