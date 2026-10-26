import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { PlatformFees } from "@/lib/event-types";

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : Number.NaN;
}

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const body = (await request.json()) as {
    commissionPct?: number;
    bookingFeeRands?: number;
    memberDiscountPct?: number;
    passBookingToBuyer?: boolean;
    passCommissionToBuyer?: boolean;
  };

  const commissionPct = money(body.commissionPct);
  const bookingFeeRands = money(body.bookingFeeRands);
  const memberDiscountPct = money(body.memberDiscountPct);
  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
    return NextResponse.json({ error: "Commission must be 0–100%." }, { status: 400 });
  }
  if (!Number.isFinite(memberDiscountPct) || memberDiscountPct < 0 || memberDiscountPct > 100) {
    return NextResponse.json({ error: "Member discount must be 0–100%." }, { status: 400 });
  }
  if (!Number.isFinite(bookingFeeRands) || bookingFeeRands < 0) {
    return NextResponse.json({ error: "Booking fee must be R 0.00 or more." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("platform_fee_settings")
    .update({
      commission_pct: commissionPct,
      booking_fee_cents: Math.round(bookingFeeRands * 100),
      member_discount_pct: memberDiscountPct,
      pass_booking_to_buyer: Boolean(body.passBookingToBuyer),
      pass_commission_to_buyer: Boolean(body.passCommissionToBuyer),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select(
      "commission_pct, booking_fee_cents, member_discount_pct, pass_booking_to_buyer, pass_commission_to_buyer",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save fee settings." },
      { status: 400 },
    );
  }

  const fees: PlatformFees = {
    commissionPct: Number(data.commission_pct),
    bookingFeeCents: Number(data.booking_fee_cents),
    memberDiscountPct: Number(data.member_discount_pct),
    passBookingToBuyer: Boolean(data.pass_booking_to_buyer),
    passCommissionToBuyer: Boolean(data.pass_commission_to_buyer),
  };

  return NextResponse.json({ fees });
}
