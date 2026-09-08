import { NextResponse } from "next/server";
import { loadPortalEvent } from "@/lib/event-access";
import { datetimeLocalToIso } from "@/lib/event-types";
import { portalEventHref } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const loaded = await loadPortalEvent(eventId, "editor");
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  const { event } = loaded;
  const body = (await request.json()) as {
    action?: string;
    startsAt?: string;
    endsAt?: string;
    refundIntent?: string;
  };

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }

  try {
    if (body.action === "copy") {
      const { data, error } = await supabase.rpc("host_copy_event", { p_event_id: event.id });
      if (error) throw new Error(error.message);
      const row = data as { id?: string };
      if (!row?.id) throw new Error("Could not copy that event.");
      return NextResponse.json({
        redirect: portalEventHref(row.id),
        notice: "Copied as a draft.",
      });
    }

    if (body.action === "cancel") {
      const { error } = await supabase.rpc("host_cancel_event", {
        p_event_id: event.id,
        p_refund_intent: body.refundIntent === "requested" ? "requested" : "none",
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ notice: "Event cancelled." });
    }

    if (body.action === "postpone") {
      const startsAt = datetimeLocalToIso(body.startsAt ?? "");
      const endsAt = datetimeLocalToIso(body.endsAt ?? "");
      if (!startsAt || !endsAt) throw new Error("Add a start and end time.");
      const { error } = await supabase.rpc("host_postpone_event", {
        p_event_id: event.id,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
        p_refund_intent: body.refundIntent === "requested" ? "requested" : "none",
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ notice: "New times saved." });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "That did not work." },
      { status: 400 },
    );
  }
}
