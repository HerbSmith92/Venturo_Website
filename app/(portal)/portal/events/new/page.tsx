import { CreateEventWizard } from "@/components/events/CreateEventWizard";
import { getCurrentUser } from "@/lib/auth";
import { requirePortalEvent } from "@/lib/event-access";
import { getPlatformFees } from "@/lib/events";
import {
  PORTAL_EVENTS_NEW,
  portalLoginHref,
  portalNewEventHref,
  type CreateEventStep,
} from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function parseStep(raw: string | undefined): CreateEventStep {
  if (raw === "tickets" || raw === "bank" || raw === "assets" || raw === "review") return raw;
  return "details";
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; step?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(portalLoginHref(false, PORTAL_EVENTS_NEW));

  const params = await searchParams;
  const step = parseStep(params.step);
  const id = params.id?.trim() ?? "";

  if (!id && step !== "details") redirect(PORTAL_EVENTS_NEW);

  let event = null;
  if (id) {
    const loaded = await requirePortalEvent(id, "editor");
    event = loaded.event;
    if (params.step !== step) redirect(portalNewEventHref(id, step));
  }

  const paidTickets = Boolean(
    event?.ticketTypes.some((ticket) => ticket.kind === "paid" && ticket.priceCents > 0),
  );
  if (id && step === "bank" && !paidTickets) redirect(portalNewEventHref(id, "assets"));

  const fees = await getPlatformFees();
  const supabase = await createClient();
  let payout: { bankName: string; accountNumberLast4: string } | null = null;
  const payoutUserId = event?.organiserId ?? user.id;
  if (supabase) {
    const { data } = await supabase
      .from("organiser_payout_profiles")
      .select("bank_name, account_number_last4")
      .eq("user_id", payoutUserId)
      .maybeSingle();
    if (data) {
      payout = {
        bankName: data.bank_name,
        accountNumberLast4: data.account_number_last4,
      };
    }
  }

  return (
    <main className="portal-studio">
      <CreateEventWizard
        key={event?.id ?? "new"}
        event={event}
        step={step}
        payout={payout}
        fees={fees}
      />
    </main>
  );
}
