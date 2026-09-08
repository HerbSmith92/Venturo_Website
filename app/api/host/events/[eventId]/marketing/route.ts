import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { loadPortalEvent } from "@/lib/event-access";
import { slugifyTitle } from "@/lib/event-types";
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
  const { event, user } = loaded;
  const body = (await request.json()) as Record<string, unknown>;
  const type = String(body.type ?? "");

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }

  try {
    if (type === "promoter") {
      const { error } = await supabase.from("event_promoters").insert({
        event_id: event.id,
        name: String(body.name ?? "").trim(),
        email: String(body.email ?? "").trim().toLowerCase(),
        incentive_pct: Number(body.incentivePct ?? 0),
        network_id: body.networkId || null,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ notice: "Ambassador added." });
    }

    if (type === "network") {
      const { data, error } = await supabase
        .from("event_promoter_networks")
        .insert({
          event_id: event.id,
          name: String(body.name ?? "").trim(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const codeIds = Array.isArray(body.codeIds)
        ? body.codeIds.map((id) => String(id)).filter(Boolean)
        : [];
      if (data?.id && codeIds.length) {
        const { error: hangError } = await supabase
          .from("event_promo_codes")
          .update({ network_id: data.id })
          .eq("event_id", event.id)
          .in("id", codeIds);
        if (hangError) throw new Error(hangError.message);
      }
      return NextResponse.json({ notice: "Network added." });
    }

    if (type === "code") {
      const { error } = await supabase.from("event_promo_codes").insert({
        event_id: event.id,
        code: String(body.code ?? "").trim().toUpperCase(),
        kind: String(body.kind ?? "percent"),
        value: body.value == null ? null : Number(body.value),
        hidden_ticket_type_id: body.hiddenTicketTypeId || null,
        promoter_id: body.promoterId || null,
        network_id: body.networkId || null,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ notice: "Code added." });
    }

    if (type === "campaign") {
      const name = String(body.name ?? "").trim();
      const slug = slugifyTitle(name) || `c-${Date.now()}`;
      const { error } = await supabase.from("event_campaigns").insert({
        event_id: event.id,
        name,
        slug,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ notice: "Campaign link ready. Paste it in the advert." });
    }

    if (type === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      const inviteKind = body.inviteKind === "rsvp" ? "rsvp" : "invite";
      if (!email) throw new Error("Add an email.");
      const token = randomBytes(18).toString("hex");
      const { error } = await supabase.from("event_invites").insert({
        event_id: event.id,
        kind: inviteKind,
        complimentary: inviteKind === "rsvp",
        email,
        name,
        token,
        created_by: user.id,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({
        notice:
          inviteKind === "rsvp"
            ? "RSVP link ready. Copy it—we do not send email yet."
            : "Invite link ready. Copy it or open a mail.",
      });
    }

    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Could not save." },
      { status: 400 },
    );
  }
}
