import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createEventDraft, type CreateEventInput, type TicketKind } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/roles";

type Body = CreateEventInput & {
  payout?: {
    accountHolder?: string;
    bankName?: string;
    accountNumber?: string;
    branchCode?: string;
  } | null;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.title?.trim() || !body.description?.trim() || !body.venueName?.trim()) {
    return NextResponse.json({ error: "Missing required event fields." }, { status: 400 });
  }
  if (!body.startsAt || !body.endsAt) {
    return NextResponse.json({ error: "Start and end times are required." }, { status: 400 });
  }
  if (new Date(body.endsAt).getTime() < new Date(body.startsAt).getTime()) {
    return NextResponse.json({ error: "End time must be after the start time." }, { status: 400 });
  }
  if (!body.ticketTypes?.length) {
    return NextResponse.json({ error: "Add at least one ticket type." }, { status: 400 });
  }

  const hasPaid = body.ticketTypes.some(
    (t) => (t.kind as TicketKind) === "paid" && t.priceCents > 0,
  );

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }

  if (hasPaid && body.payout?.accountNumber) {
    const account = body.payout.accountNumber.replace(/\s+/g, "");
    const last4 = account.slice(-4);
    const { error: payoutError } = await supabase.from("organiser_payout_profiles").upsert({
      user_id: user.id,
      account_holder: body.payout.accountHolder?.trim() || user.firstName,
      bank_name: body.payout.bankName?.trim() || "Bank",
      account_number_last4: last4 || "0000",
      account_number_enc: Buffer.from(account).toString("base64"),
      branch_code: body.payout.branchCode?.trim() || null,
      updated_at: new Date().toISOString(),
    });
    if (payoutError) {
      return NextResponse.json({ error: payoutError.message }, { status: 400 });
    }
  } else if (hasPaid && body.submitForReview) {
    const { data: existing } = await supabase
      .from("organiser_payout_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json(
        { error: "Add a payout bank account before submitting paid tickets." },
        { status: 400 },
      );
    }
  }

  try {
    const event = await createEventDraft(user.id, {
      ...body,
      isStaff: isStaff(user.role),
    });
    return NextResponse.json({
      redirect: isStaff(user.role) && body.submitForReview
        ? `/events/${event.slug}`
        : "/account/events",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create event." },
      { status: 400 },
    );
  }
}
