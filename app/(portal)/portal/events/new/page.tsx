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
  if (raw === "tickets" || raw === "assets") return raw;
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

  const fees = await getPlatformFees();
  const supabase = await createClient();
  let hasPayout = false;
  if (supabase && event) {
    const { data } = await supabase
      .from("organiser_payout_profiles")
      .select("user_id")
      .eq("user_id", event.organiserId)
      .maybeSingle();
    hasPayout = Boolean(data);
  } else if (supabase) {
    const { data } = await supabase
      .from("organiser_payout_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    hasPayout = Boolean(data);
  }

  return (
    <main className="portal-studio">
      <CreateEventWizard
        key={event?.id ?? "new"}
        event={event}
        step={step}
        hasPayout={hasPayout}
        fees={fees}
      />
    </main>
  );
}
