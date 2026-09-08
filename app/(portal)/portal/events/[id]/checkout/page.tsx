import { EventStudio } from "@/components/events/EventStudio";
import { EventChrome } from "@/components/portal/EventChrome";
import { requirePortalEvent } from "@/lib/event-access";
import { getPlatformFees } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

export default async function PortalCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event, access } = await requirePortalEvent(id, "editor");
  const fees = await getPlatformFees();
  const supabase = await createClient();
  let hasPayout = false;
  if (supabase) {
    const { data } = await supabase
      .from("organiser_payout_profiles")
      .select("user_id")
      .eq("user_id", event.organiserId)
      .maybeSingle();
    hasPayout = Boolean(data);
  }

  return (
    <main className="portal-studio">
      <EventChrome event={event} current="checkout">
        <EventStudio
          event={event}
          isStaff={access === "staff"}
          hasPayout={hasPayout}
          commissionPct={fees.commissionPct}
          bookingFeeCents={fees.bookingFeeCents}
          stay="portal"
          focus="checkout"
        />
      </EventChrome>
    </main>
  );
}
