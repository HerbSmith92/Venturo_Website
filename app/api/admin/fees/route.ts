import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const body = (await request.json()) as {
    commissionPct?: number;
    bookingFeeRands?: number;
  };

  const commissionPct = Number(body.commissionPct);
  const bookingFeeRands = Number(body.bookingFeeRands);
  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
    return NextResponse.json({ error: "Commission must be 0–100%." }, { status: 400 });
  }
  if (!Number.isFinite(bookingFeeRands) || bookingFeeRands < 0) {
    return NextResponse.json({ error: "Booking fee must be R 0.00 or more." }, { status: 400 });
  }

  const bookingFeeCents = Math.round(bookingFeeRands * 100);
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("platform_fee_settings")
    .update({
      commission_pct: commissionPct,
      booking_fee_cents: bookingFeeCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select("commission_pct, booking_fee_cents")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save fee settings." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    commissionPct: Number(data.commission_pct),
    bookingFeeCents: Number(data.booking_fee_cents),
  });
}
